import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SessionAccountService } from '../session-account/session-account.service';
import { UniswapV3Service } from '../common/services/uniswap-v3.service';
import {
  createPublicClient,
  http,
  type Address,
  type Hash,
  encodeFunctionData,
  parseEther,
  hexToBytes,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient } from 'viem/account-abstraction';
import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { type ExecutionDecision } from '../common/types';

/**
 * ExecutionService handles the actual execution of DCA trades
 * using ERC-7715 permissions and Pimlico bundler for Uniswap V3
 */
@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private encryption: EncryptionService,
    private permissions: PermissionsService,
    private sessionAccounts: SessionAccountService,
    private uniswapV3: UniswapV3Service,
  ) {}

  /**
   * Execute a swap for a given execution
   * This is the main entry point for trade execution
   */
  async executeSwap(executionId: string): Promise<{
    success: boolean;
    txHash?: Hash;
    error?: string;
  }> {
    try {
      this.logger.log(`Starting execution for: ${executionId}`);

      // 1. Get execution and strategy
      const execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          strategy: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      // 2. Validate permission is still active
      const permission = await this.validatePermission(
        execution.strategy.userId,
      );
      if (!permission) {
        throw new Error('No active permission found for user');
      }

      // 3. Get session account and decrypt private key
      const sessionAccount = await this.prisma.sessionAccount.findFirst({
        where: {
          userId: execution.strategy.userId,
          isActive: true,
        },
      });

      if (!sessionAccount) {
        throw new Error('No active session account found');
      }

      const privateKey = this.encryption.decrypt(
        sessionAccount.encryptedPrivateKey,
      ) as `0x${string}`;

      // 4. Create clients
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.config.get('blockchain.rpcUrl')),
      });

      const account = privateKeyToAccount(privateKey);

      // 5. Create MetaMask Smart Account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [account.address, [], [], []],
        deploySalt: '0x',
        signer: { account },
      });

      this.logger.log(
        `Smart account address: ${smartAccount.address}`,
      );

      // 6. Get swap parameters
      const decision = execution.decision as unknown as ExecutionDecision;
      const amountIn = decision.recommendedAmount;

      // 7. STEP 1: Check balance and fund session account if needed
      // First check if the smart account already has enough ETH
      const currentBalance = await publicClient.getBalance({
        address: smartAccount.address,
      });

      this.logger.log(`Current smart account balance: ${currentBalance} wei (${Number(currentBalance) / 1e18} ETH)`);

      // Calculate total needed (swap amount + gas buffer)
      const gasBuffer = BigInt(1000000000000000); // 0.001 ETH for gas
      const totalNeeded = BigInt(amountIn) + gasBuffer;

      this.logger.log(`Total needed for swap: ${totalNeeded} wei (${Number(totalNeeded) / 1e18} ETH)`);

      // Only fund if balance is insufficient
      if (currentBalance < totalNeeded) {
        const fundingAmount = totalNeeded - currentBalance;
        this.logger.log(`Insufficient balance. Funding ${fundingAmount} wei using delegation...`);

        await this.fundSessionAccount(
          smartAccount,
          fundingAmount,
          permission,
          publicClient,
        );

        this.logger.log(`Session account funded with ${fundingAmount} wei`);
      } else {
        this.logger.log(`✅ Sufficient balance already available. Skipping funding step.`);
      }

      // 8. STEP 2: Wrap ETH to WETH and approve SwapRouter (V3 requirement)
      await this.wrapAndApproveWETH(
        smartAccount,
        amountIn,
        this.uniswapV3.getWethAddress(),
        this.uniswapV3.getSwapRouterAddress(),
      );

      // 9. STEP 3: Execute Uniswap V3 swap using session account's own funds (no delegation)
      const swapTx = await this.uniswapV3.buildSwapCalldata(
        execution.strategy.pairId,
        amountIn,
        execution.strategy.slippage,
      );

      // Update recipient in the calldata to use the smart account address
      const updatedSwapTx = this.updateRecipientInCalldata(
        swapTx.data,
        smartAccount.address,
      );

      const txHash = await this.executeSwapWithSessionAccount(
        smartAccount,
        swapTx.to,
        updatedSwapTx,
        swapTx.value,
      );

      // 8. Update execution record
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'executed',
          txHash,
          executedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Execution successful! TxHash: ${txHash}`,
      );

      return { success: true, txHash };
    } catch (error) {
      this.logger.error(`Execution failed: ${error.message}`, error.stack);

      // Update execution with error
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Validate that user has an active permission
   */
  private async validatePermission(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const permissions = await this.permissions.getUserPermissions(
      user.walletAddress,
    );

    // Get all active permissions and sort by creation date (newest first)
    const activePermissions = permissions
      .filter(
        (p) =>
          p.expiresAt > new Date() &&
          !p.revokedAt &&
          p.permissionType === 'native-token-periodic',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Log all active permissions for debugging
    this.logger.log(`Found ${activePermissions.length} active permissions for user ${userId}`);
    activePermissions.forEach((p, idx) => {
      const permData = p.permissionData as any;
      const ethAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`  [${idx}] Created: ${p.createdAt.toISOString()}, Amount: ${ethAmount}, ID: ${p.id.substring(0, 8)}`);
    });

    // Return the most recent permission
    const selectedPermission = activePermissions[0] || null;
    if (selectedPermission) {
      const permData = selectedPermission.permissionData as any;
      const ethAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`✅ Using permission: ${selectedPermission.id.substring(0, 8)} with ETH amount: ${ethAmount}`);
    }

    return selectedPermission;
  }

  /**
   * STEP 1: Fund session account with ETH using ERC-7715 delegation
   * This transfers ETH from the user's account to the session account using native-token-periodic permission
   */
  private async fundSessionAccount(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    amount: bigint,
    permission: any,
    publicClient: any,
  ): Promise<void> {
    try {
      this.logger.log(`Funding session account with ${amount} wei using delegation`);

      // Get Pimlico configuration
      const pimlicoApiKey = this.config.get('pimlico.apiKey');

      if (!pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      // Extract permission data from database object
      const permissionData = permission.permissionData as any;
      const { context, signerMeta } = permissionData;

      if (!context) {
        throw new Error('Permission context not found in permissionData');
      }

      if (!signerMeta?.delegationManager) {
        throw new Error('Delegation manager not found in permission signerMeta');
      }

      this.logger.log(`Permission context: ${context.substring(0, 20)}...`);
      this.logger.log(`Delegation manager: ${signerMeta.delegationManager}`);

      // Create Pimlico client for gas estimation
      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
        ),
      });

      // Get gas prices from Pimlico
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      this.logger.log(`Gas fees - maxFeePerGas: ${fee.maxFeePerGas}, maxPriorityFeePerGas: ${fee.maxPriorityFeePerGas}`);

      // Create bundler client with ERC-7710 actions for delegation and extended timeout
      const bundlerClient = createBundlerClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
          {
            timeout: 60_000, // 60 seconds timeout (Sepolia has slower block times)
          }
        ),
        paymaster: true,
      }).extend(erc7710BundlerActions()) as any;

      // Transfer ETH from user to session account using delegation
      // This is a simple ETH transfer, which is what native-token-periodic permission allows
      const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
        publicClient,
        account: smartAccount,
        calls: [{
          to: smartAccount.address, // Transfer to session account itself
          data: '0x', // No calldata - simple ETH transfer
          value: amount,
          permissionsContext: context,
          delegationManager: signerMeta.delegationManager,
        }],
        ...fee,
      });

      this.logger.log(`Funding UserOperation submitted: ${userOpHash}`);

      // Wait for UserOperation to be included on-chain
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      this.logger.log(`Funding confirmed in block: ${receipt.receipt.blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to fund session account: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * STEP 2: Execute Uniswap swap using session account's own funds (no delegation)
   * This calls the PoolManager contract directly from the session account
   */
  private async executeSwapWithSessionAccount(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    to: Address,
    data: `0x${string}`,
    value: bigint,
  ): Promise<Hash> {
    try {
      this.logger.log('Executing Uniswap swap with session account funds');

      // Get Pimlico configuration
      const pimlicoApiKey = this.config.get('pimlico.apiKey');

      if (!pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      // Create public client for transaction monitoring
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.config.get('blockchain.rpcUrl')),
      });

      this.logger.log(`Sending swap to: ${to}`);
      this.logger.log(`Value: ${value}`);

      // Create Pimlico client for gas estimation
      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
        ),
      });

      // Get gas prices from Pimlico
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      this.logger.log(`Gas fees - maxFeePerGas: ${fee.maxFeePerGas}, maxPriorityFeePerGas: ${fee.maxPriorityFeePerGas}`);

      // Create bundler client with extended timeout for Sepolia
      const bundlerClient = createBundlerClient({
        account: smartAccount,
        chain: sepolia,
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
          {
            timeout: 60_000, // 60 seconds timeout (Sepolia has slower block times)
          }
        ),
      });

      // Import sendUserOperation from viem
      const { sendUserOperation, waitForUserOperationReceipt } = await import('viem/account-abstraction');

      // Send regular UserOperation (no delegation)
      const userOpHash = await sendUserOperation(bundlerClient, {
        calls: [{
          to,
          data,
          value,
        }],
        ...fee,
        // Override gas limits - HybridDeleGator needs more verification gas
        verificationGasLimit: BigInt(150_000), // Increased from default ~34k
        callGasLimit: BigInt(300_000), // Swap needs more gas than wrap+approve
      });

      this.logger.log(`Swap UserOperation submitted: ${userOpHash}`);

      // Wait for UserOperation to be included on-chain
      const receipt = await waitForUserOperationReceipt(bundlerClient, {
        hash: userOpHash,
      });

      this.logger.log(`Swap confirmed in block: ${receipt.receipt.blockNumber}`);
      this.logger.log(`Transaction hash: ${receipt.receipt.transactionHash}`);

      return receipt.receipt.transactionHash;
    } catch (error) {
      this.logger.error(`Failed to execute swap: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Wrap ETH to WETH and approve SwapRouter to spend WETH
   * Required for Uniswap V3 which uses WETH instead of native ETH
   */
  private async wrapAndApproveWETH(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    amount: bigint,
    wethAddress: Address,
    swapRouterAddress: Address,
  ): Promise<void> {
    try {
      this.logger.log(`Wrapping ${amount} wei ETH to WETH and approving SwapRouter`);

      // Get Pimlico configuration
      const pimlicoApiKey = this.config.get('pimlico.apiKey');

      if (!pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      // Create public client for transaction monitoring
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.config.get('blockchain.rpcUrl')),
      });

      // Create Pimlico client for gas estimation
      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
        ),
      });

      // Get gas prices from Pimlico
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      // Create bundler client with extended timeout for Sepolia
      const bundlerClient = createBundlerClient({
        account: smartAccount,
        chain: sepolia,
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
          {
            timeout: 60_000, // 60 seconds timeout (Sepolia has slower block times)
          }
        ),
      });

      // Import sendUserOperation from viem
      const { sendUserOperation, waitForUserOperationReceipt } = await import('viem/account-abstraction');
      const { parseAbi } = await import('viem');

      // WETH ABI for deposit and approve
      const wethAbi = parseAbi([
        'function deposit() payable',
        'function approve(address spender, uint256 amount) returns (bool)',
      ]);

      // Encode deposit call
      const depositData = encodeFunctionData({
        abi: wethAbi,
        functionName: 'deposit',
        args: [],
      });

      // Encode approve call
      const approveData = encodeFunctionData({
        abi: wethAbi,
        functionName: 'approve',
        args: [swapRouterAddress, amount],
      });

      // Send batch UserOperation: deposit + approve
      // Set explicit gas limits to avoid AA26 error (verification gas too low)
      const userOpHash = await sendUserOperation(bundlerClient, {
        calls: [
          {
            to: wethAddress,
            data: depositData,
            value: amount, // Send ETH to wrap
          },
          {
            to: wethAddress,
            data: approveData,
            value: BigInt(0),
          },
        ],
        ...fee,
        // Override gas limits - HybridDeleGator needs more verification gas
        verificationGasLimit: BigInt(150_000), // Increased from default ~34k
        callGasLimit: BigInt(200_000), // Sufficient for WETH deposit + approve
      });

      this.logger.log(`WETH wrap+approve UserOperation submitted: ${userOpHash}`);

      // Wait for UserOperation to be included on-chain
      const receipt = await waitForUserOperationReceipt(bundlerClient, {
        hash: userOpHash,
      });

      this.logger.log(`WETH wrap+approve confirmed in block: ${receipt.receipt.blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to wrap WETH and approve: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update the recipient address in the swap calldata
   * The V3 service encodes with zero address, we replace it with the actual smart account
   */
  private updateRecipientInCalldata(
    calldata: `0x${string}`,
    recipient: Address,
  ): `0x${string}` {
    // The recipient is the 4th parameter in the struct (after tokenIn, tokenOut, fee)
    // Each address is 32 bytes in the ABI encoding
    // Function selector (4 bytes) + tokenIn (32 bytes) + tokenOut (32 bytes) + fee (32 bytes) + recipient (32 bytes)
    // = 4 + 32 + 32 + 32 = 100 bytes offset to recipient

    const recipientOffset = 4 + 32 + 32 + 32; // 100 in decimal, 0x64 in hex
    const recipientStartHex = recipientOffset * 2 + 2; // *2 for hex chars, +2 for 0x prefix

    // Remove 0x prefix from recipient and pad to 32 bytes (64 hex chars)
    const recipientHex = recipient.slice(2).padStart(64, '0');

    // Replace the recipient in the calldata
    const updated =
      calldata.slice(0, recipientStartHex) +
      recipientHex +
      calldata.slice(recipientStartHex + 64);

    return updated as `0x${string}`;
  }
}
