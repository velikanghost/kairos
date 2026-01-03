import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SessionAccountService } from '../session-account/session-account.service';
import { UniswapV3Service } from '../common/services/uniswap-v3.service';
import { PythOracleService } from '../common/services/pyth-oracle.service';
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
    private pythOracleService: PythOracleService,
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

      // 2. Validate permissions are still active
      const { ethPermission, usdcPermission } = await this.validatePermission(
        execution.strategy.userId,
      );
      if (!ethPermission && !usdcPermission) {
        throw new Error('No active permissions found for user');
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

      // 6. Get swap parameters and determine amount based on pair direction
      const decision = execution.decision as unknown as ExecutionDecision;
      const recommendedAmount = decision.recommendedAmount;

      // Check if this is a USDC-based pair (USDC/WETH or USDC/ETH)
      // or an ETH-based pair (ETH/USDC or WETH/USDC)
      const isUsdcBasedPair = execution.strategy.pairId.startsWith('USDC/');

      let usdcAmount: bigint;

      if (isUsdcBasedPair) {
        // For USDC-based pairs, the recommendedAmount is already in USDC units (6 decimals)
        usdcAmount = BigInt(recommendedAmount);
        this.logger.log(`USDC-based pair detected. Using ${usdcAmount} USDC units (~${Number(usdcAmount) / 1e6} USDC) directly from strategy`);
      } else {
        // For ETH-based pairs, convert ETH amount to equivalent USDC amount
        const ethAmountInWei = recommendedAmount; // Amount in ETH wei (18 decimals)
        const ethPriceUsd = decision.indicators?.price || 3000; // Default to $3000 if not available

        // Calculate USDC amount: (ETH amount in wei / 10^18) * ETH price * 10^6 (USDC decimals)
        // Simplified: (ethAmountInWei * ethPriceUsd * 10^6) / 10^18 = (ethAmountInWei * ethPriceUsd) / 10^12
        usdcAmount = (BigInt(ethAmountInWei) * BigInt(Math.floor(ethPriceUsd))) / BigInt(10 ** 12);
        this.logger.log(`ETH-based pair detected. Converting ${ethAmountInWei} wei ETH (~${Number(ethAmountInWei) / 1e18} ETH) to ${usdcAmount} USDC units (~${Number(usdcAmount) / 1e6} USDC) at $${ethPriceUsd}/ETH`);
      }

      // 7. STEP 1: Check ETH balance for gas (we don't need ETH for the swap itself)
      // Note: Gas fees are sponsored by Pimlico paymaster (configured with paymaster: true)
      // No need to fund session account with ETH for gas
      this.logger.log(`Gas fees will be sponsored by Pimlico paymaster`);

      // TODO: Remove this code block once paymaster is confirmed working
      // // The swap will use USDC, but we need ETH for gas fees
      // const currentBalance = await publicClient.getBalance({
      //   address: smartAccount.address,
      // });

      // this.logger.log(`Current smart account balance: ${currentBalance} wei (${Number(currentBalance) / 1e18} ETH)`);

      // // Calculate gas needed (not swap amount, since we're using USDC)
      // const gasBuffer = BigInt(5000000000000000); // 0.005 ETH for gas (UserOp fees)

      // this.logger.log(`Gas buffer needed: ${gasBuffer} wei (${Number(gasBuffer) / 1e18} ETH)`);

      // // Only fund ETH if balance is insufficient for gas
      // if (currentBalance < gasBuffer) {
      //   if (!ethPermission) {
      //     throw new Error('No ETH permission found. Cannot fund session account for gas fees.');
      //   }
      //   const fundingAmount = gasBuffer - currentBalance;
      //   this.logger.log(`Insufficient ETH for gas. Funding ${fundingAmount} wei using delegation...`);

      //   await this.fundSessionAccountWithETH(
      //     smartAccount,
      //     fundingAmount,
      //     ethPermission,
      //     publicClient,
      //   );

      //   this.logger.log(`Session account funded with ${fundingAmount} wei for gas`);
      // } else {
      //   this.logger.log(`✅ Sufficient ETH balance for gas fees. Skipping ETH funding step.`);
      // }

      // 8. STEP 2: Transfer USDC from user's EOA to session account using delegation
      const usdcAddress = this.uniswapV3.getUsdcAddress();
      const swapRouterAddress = this.uniswapV3.getSwapRouterAddress();

      // Check USDC balance in session account
      const usdcBalance = await this.getERC20Balance(
        smartAccount.address,
        usdcAddress,
        publicClient,
      );

      this.logger.log(`Session account USDC balance: ${usdcBalance} (${Number(usdcBalance) / 1e6} USDC)`);

      // Transfer USDC from user to session account if needed
      if (usdcBalance < usdcAmount) {
        if (!usdcPermission) {
          throw new Error(
            `Insufficient USDC balance. Have: ${Number(usdcBalance) / 1e6} USDC, Need: ${Number(usdcAmount) / 1e6} USDC. ` +
            `No USDC permission found. Please grant ERC-20 token permission for USDC transfers.`
          );
        }

        const usdcNeeded = usdcAmount - usdcBalance;
        this.logger.log(`Need to transfer ${usdcNeeded} USDC (~${Number(usdcNeeded) / 1e6} USDC) from user to session account`);

        // Check user's USDC balance before transfer
        const userWalletAddress = execution.strategy.user.walletAddress as Address;
        const userUsdcBalance = await this.getERC20Balance(
          userWalletAddress,
          usdcAddress,
          publicClient,
        );
        this.logger.log(`User wallet (${userWalletAddress}) USDC balance: ${userUsdcBalance} (${Number(userUsdcBalance) / 1e6} USDC)`);

        if (userUsdcBalance < usdcNeeded) {
          throw new Error(
            `User has insufficient USDC balance. User has: ${Number(userUsdcBalance) / 1e6} USDC, Need: ${Number(usdcNeeded) / 1e6} USDC`
          );
        }

        await this.transferUSDCToSessionAccount(
          smartAccount,
          usdcNeeded,
          usdcPermission,
          usdcAddress,
          publicClient,
        );

        this.logger.log(`✅ USDC transfer completed`);

        // Verify session account received the USDC
        const newUsdcBalance = await this.getERC20Balance(
          smartAccount.address,
          usdcAddress,
          publicClient,
        );
        this.logger.log(`Session account USDC balance after transfer: ${newUsdcBalance} (${Number(newUsdcBalance) / 1e6} USDC)`);

        if (newUsdcBalance < usdcAmount) {
          throw new Error(
            `USDC transfer failed! Session account has ${Number(newUsdcBalance) / 1e6} USDC but needs ${Number(usdcAmount) / 1e6} USDC`
          );
        }
      } else {
        this.logger.log(`✅ Sufficient USDC balance for swap. Skipping USDC transfer step.`);
      }

      // Approve SwapRouter to spend USDC from session account
      await this.approveToken(
        smartAccount,
        usdcAddress,
        swapRouterAddress,
        usdcAmount,
      );

      // 9. STEP 3: Execute Uniswap V3 swap USDC → WETH (buying ETH with stablecoin)
      // For DCA, the pair should be "USDC/ETH" (swap USDC for ETH)
      const swapTx = await this.uniswapV3.buildSwapCalldata(
        'USDC/WETH', // DCA: Use stablecoin to buy ETH
        usdcAmount,
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

      // 8. Fetch current ETH price from Pyth at execution time
      const currentEthPrice = await this.pythOracleService.getPrice('ETH/USD');
      this.logger.log(`ETH price at execution: $${currentEthPrice.toFixed(2)}`);

      // 9. Fetch actual swap amounts from transaction receipt
      const { actualUsdcIn, actualWethOut } = await this.getSwapAmountsFromTx(
        txHash,
        publicClient,
      );

      // 10. Calculate actual USDC equivalent of WETH received
      // This is what we'll use for portfolio calculations (more accurate than actualUsdcIn from logs)
      let actualUsdcEquivalent: bigint | null = null;
      if (actualWethOut && currentEthPrice) {
        // WETH has 18 decimals, USDC has 6 decimals
        // wethAmount (18 decimals) * ethPrice / 1e12 = usdcAmount (6 decimals)
        const wethInEth = Number(actualWethOut) / 1e18; // Convert to ETH
        const usdcEquivalent = wethInEth * currentEthPrice; // Calculate USD value
        actualUsdcEquivalent = BigInt(Math.floor(usdcEquivalent * 1e6)); // Convert to USDC units (6 decimals)

        this.logger.log(
          `💰 Calculated USDC equivalent: ${usdcEquivalent.toFixed(6)} USDC (${wethInEth.toFixed(8)} WETH × $${currentEthPrice.toFixed(2)})`
        );
      }

      // 11. Update execution record with actual amounts and execution price
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'executed',
          txHash,
          executedAt: new Date(),
          usdcAmountIn: actualUsdcEquivalent?.toString() || actualUsdcIn?.toString(), // Prefer calculated USDC equivalent
          wethAmountOut: actualWethOut?.toString(),
          executionPrice: currentEthPrice, // Use Pyth price at execution time
        },
      });

      this.logger.log(
        `✅ Execution successful! TxHash: ${txHash}`,
      );
      this.logger.log(
        `   USDC equivalent: ${actualUsdcEquivalent ? Number(actualUsdcEquivalent) / 1e6 : 'N/A'} | WETH received: ${actualWethOut ? Number(actualWethOut) / 1e18 : 'N/A'} | ETH Price: $${currentEthPrice.toFixed(2)}`,
      );

      return { success: true, txHash };
    } catch (error) {
      this.logger.error(`Execution failed: ${error.message}`, error.stack);

      // Format error message for user-friendly display
      const { formatErrorMessage } = await import('../common/error-formatter.js');
      const friendlyError = formatErrorMessage(error);

      // Update execution with error
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          errorMessage: friendlyError,
        },
      });

      return { success: false, error: friendlyError };
    }
  }

  /**
   * Validate that user has an active permission
   * Returns both ETH permission (for gas) and USDC permission (for DCA swaps)
   */
  private async validatePermission(userId: string): Promise<{
    ethPermission: any;
    usdcPermission: any;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const permissions = await this.permissions.getUserPermissions(
      user.walletAddress,
    );

    // Get ETH permission for gas fees
    const ethPermissions = permissions
      .filter(
        (p) =>
          p.expiresAt > new Date() &&
          !p.revokedAt &&
          p.permissionType === 'native-token-periodic',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Get USDC permission for DCA swaps
    const usdcPermissions = permissions
      .filter(
        (p) =>
          p.expiresAt > new Date() &&
          !p.revokedAt &&
          p.permissionType === 'erc20-token-periodic',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Log all active permissions for debugging
    this.logger.log(`Found ${ethPermissions.length} ETH permissions and ${usdcPermissions.length} USDC permissions for user ${userId}`);

    ethPermissions.forEach((p, idx) => {
      const permData = p.permissionData as any;
      const ethAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`  ETH [${idx}] Created: ${p.createdAt.toISOString()}, Amount: ${ethAmount}, ID: ${p.id.substring(0, 8)}`);
    });

    usdcPermissions.forEach((p, idx) => {
      const permData = p.permissionData as any;
      const usdcAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`  USDC [${idx}] Created: ${p.createdAt.toISOString()}, Amount: ${usdcAmount}, ID: ${p.id.substring(0, 8)}`);
    });

    // Return the most recent permissions
    const ethPermission = ethPermissions[0] || null;
    const usdcPermission = usdcPermissions[0] || null;

    if (ethPermission) {
      const permData = ethPermission.permissionData as any;
      const ethAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`✅ Using ETH permission: ${ethPermission.id.substring(0, 8)} with amount: ${ethAmount}`);
    }

    if (usdcPermission) {
      const permData = usdcPermission.permissionData as any;
      const usdcAmount = permData?.permission?.data?.periodAmount || 'unknown';
      this.logger.log(`✅ Using USDC permission: ${usdcPermission.id.substring(0, 8)} with amount: ${usdcAmount}`);
    }

    return { ethPermission, usdcPermission };
  }

  /**
   * STEP 1: Fund session account with ETH using ERC-7715 delegation
   * This transfers ETH from the user's account to the session account using native-token-periodic permission
   */
  private async fundSessionAccountWithETH(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    amount: bigint,
    permission: any,
    publicClient: any,
  ): Promise<void> {
    try {
      this.logger.log(`Funding session account with ${amount} wei ETH using delegation`);

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
   * Transfer USDC from user's wallet to session account using ERC-20 delegation
   * This uses erc20-token-periodic permission
   */
  private async transferUSDCToSessionAccount(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    amount: bigint,
    permission: any,
    usdcAddress: Address,
    publicClient: any,
  ): Promise<void> {
    try {
      this.logger.log(`Transferring ${amount} USDC (${Number(amount) / 1e6} USDC) from user wallet to session account using delegation`);

      // Get Pimlico configuration
      const pimlicoApiKey = this.config.get('pimlico.apiKey');

      if (!pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      // Create Pimlico client for gas estimation
      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
        ),
      });

      // Get gas prices from Pimlico
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      this.logger.log(`Gas fees - maxFeePerGas: ${fee.maxFeePerGas}, maxPriorityFeePerGas: ${fee.maxPriorityFeePerGas}`);

      // Create bundler client with ERC-7710 actions for delegation
      const bundlerClient = createBundlerClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
          {
            timeout: 60_000,
          }
        ),
        paymaster: true,
      }).extend(erc7710BundlerActions()) as any;

      // Extract permission context and delegation manager
      const permissionData = permission.permissionData as any;
      const context = permissionData.permissionsContext || permission.permissionContext;
      const signerMeta = permissionData.signerMeta || {};

      this.logger.log(`Attempting ERC-20 transfer with delegation:`);
      this.logger.log(`  From: User's EOA wallet`);
      this.logger.log(`  To: ${smartAccount.address} (session account)`);
      this.logger.log(`  Token: ${usdcAddress} (USDC)`);
      this.logger.log(`  Amount: ${amount} (${Number(amount) / 1e6} USDC)`);

      // According to MetaMask docs, for ERC-20 token permissions:
      // - to: tokenAddress (the ERC-20 contract)
      // - data: the actual ERC-20 function call (e.g., transfer)
      const { parseAbi } = await import('viem');
      const erc20Abi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);

      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [smartAccount.address, amount],
      });

      this.logger.log(`Encoded transfer calldata: ${transferData}`);

      // Use delegation to transfer USDC from user's wallet to session account
      const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
        publicClient,
        account: smartAccount,
        calls: [{
          to: usdcAddress,           // Call the USDC token contract
          data: transferData,        // transfer(sessionAccount, amount)
          value: BigInt(0),          // No native ETH
          permissionsContext: context,
          delegationManager: signerMeta.delegationManager,
        }],
        ...fee,
        verificationGasLimit: BigInt(500_000),
        callGasLimit: BigInt(800_000),
      });

      this.logger.log(`USDC transfer UserOperation submitted: ${userOpHash}`);

      // Wait for confirmation
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      this.logger.log(`USDC transfer confirmed in block: ${receipt.receipt.blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to transfer USDC: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * STEP 3: Execute Uniswap swap using session account's own funds (NO delegation)
   * Session account already has USDC from the transfer step
   */
  private async executeSwapWithSessionAccount(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    to: Address,
    data: `0x${string}`,
    value: bigint,
  ): Promise<Hash> {
    try {
      this.logger.log('Executing Uniswap swap using session account funds (no delegation needed)');

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
        paymaster: true,
      });

      // Import sendUserOperation from viem
      const { sendUserOperation, waitForUserOperationReceipt } = await import('viem/account-abstraction');

      // Send regular UserOperation (no delegation - session account has its own USDC)
      const userOpHash = await sendUserOperation(bundlerClient, {
        calls: [{
          to,
          data,
          value,
        }],
        ...fee,
        // Override gas limits for swap
        verificationGasLimit: BigInt(150_000),
        callGasLimit: BigInt(300_000),
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
   * Get ERC20 token balance for an address
   */
  private async getERC20Balance(
    address: Address,
    tokenAddress: Address,
    publicClient: any,
  ): Promise<bigint> {
    const { parseAbi } = await import('viem');

    const erc20Abi = parseAbi([
      'function balanceOf(address account) view returns (uint256)',
    ]);

    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });

    return balance as bigint;
  }

  /**
   * Approve SwapRouter to spend tokens from session account
   * Generic method that works for any ERC20 token
   */
  private async approveToken(
    smartAccount: MetaMaskSmartAccount<Implementation>,
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
  ): Promise<void> {
    try {
      this.logger.log(`Approving ${spenderAddress} to spend ${amount} of token ${tokenAddress}`);

      // Get Pimlico configuration
      const pimlicoApiKey = this.config.get('pimlico.apiKey');

      if (!pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      // Create Pimlico client for gas estimation
      const pimlicoClient = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
        ),
      });

      // Get gas prices from Pimlico
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      // Create bundler client
      const bundlerClient = createBundlerClient({
        account: smartAccount,
        chain: sepolia,
        transport: http(
          `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${pimlicoApiKey}`,
          {
            timeout: 60_000,
          }
        ),
        paymaster: true,
      });

      // Import viem functions
      const { sendUserOperation, waitForUserOperationReceipt } = await import('viem/account-abstraction');
      const { parseAbi } = await import('viem');

      // ERC20 approve ABI
      const erc20Abi = parseAbi([
        'function approve(address spender, uint256 amount) returns (bool)',
      ]);

      // Encode approve call
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, amount],
      });

      // Send UserOperation to approve
      const userOpHash = await sendUserOperation(bundlerClient, {
        calls: [{
          to: tokenAddress,
          data: approveData,
          value: BigInt(0),
        }],
        ...fee,
        verificationGasLimit: BigInt(150_000),
        callGasLimit: BigInt(100_000),
      });

      this.logger.log(`Token approve UserOperation submitted: ${userOpHash}`);

      // Wait for confirmation
      const receipt = await waitForUserOperationReceipt(bundlerClient, {
        hash: userOpHash,
      });

      this.logger.log(`Token approve confirmed in block: ${receipt.receipt.blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to approve token: ${error.message}`, error.stack);
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

  /**
   * Extract actual swap amounts from transaction receipt logs
   * Looks for Transfer events from USDC and WETH contracts
   */
  private async getSwapAmountsFromTx(
    txHash: Hash,
    publicClient: any,
  ): Promise<{
    actualUsdcIn: bigint | null;
    actualWethOut: bigint | null;
  }> {
    try {
      const { keccak256, toHex } = await import('viem');

      this.logger.log(`Fetching transaction receipt for: ${txHash}`);

      // Get transaction receipt
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      this.logger.log(`Receipt status: ${receipt.status}, logs count: ${receipt.logs?.length || 0}`);

      // ERC20 Transfer event signature: keccak256("Transfer(address,address,uint256)")
      const transferEventTopic = keccak256(toHex('Transfer(address,address,uint256)'));

      // Token addresses on Sepolia
      const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address;
      const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address;

      this.logger.log(`Looking for transfers - USDC: ${USDC_ADDRESS}, WETH: ${WETH_ADDRESS}`);

      let usdcAmount: bigint | null = null;
      let wethAmount: bigint | null = null;

      // Parse logs to find Transfer events
      for (const log of receipt.logs) {
        this.logger.debug(`Log ${log.logIndex}: address=${log.address}, topics[0]=${log.topics[0]}, data=${log.data}`);

        // Check if this is a Transfer event
        if (log.topics[0] === transferEventTopic) {
          const value = BigInt(log.data);

          // Check if it's from USDC contract (user spending USDC)
          if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
            usdcAmount = value;
            this.logger.log(`✅ Found USDC Transfer: ${Number(value) / 1e6} USDC`);
          }

          // Check if it's from WETH contract (user receiving WETH)
          if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
            wethAmount = value;
            this.logger.log(`✅ Found WETH Transfer: ${Number(value) / 1e18} WETH`);
          }
        }
      }

      if (!usdcAmount) {
        this.logger.warn(`⚠️ No USDC Transfer found in transaction logs`);
      }
      if (!wethAmount) {
        this.logger.warn(`⚠️ No WETH Transfer found in transaction logs`);
      }

      return {
        actualUsdcIn: usdcAmount,
        actualWethOut: wethAmount,
      };
    } catch (error) {
      this.logger.error(`Failed to extract swap amounts from tx: ${error.message}`, error.stack);
      return {
        actualUsdcIn: null,
        actualWethOut: null,
      };
    }
  }
}
