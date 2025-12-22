import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Web3AuthService } from './web3auth.service';
import { createPublicClient, http, Address } from 'viem';
import { monad } from 'viem/chains';
import {
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private web3AuthService: Web3AuthService,
  ) {}

  /**
   * Authenticate user via Web3Auth
   * Frontend sends the idToken after user logs in
   * Backend derives the user's wallet using Web3Auth's MPC
   */
  async authenticateUser(payload: {
    authConnectionId: string; // From Web3Auth Dashboard
    idToken: string;          // JWT from auth provider
    userId?: string;          // Optional: override user ID
    email?: string;
    name?: string;
  }) {
    try {
      this.logger.log(`Authenticating user via Web3Auth (${payload.authConnectionId})...`);

      // Get user's EOA address from Web3Auth
      const eoaAddress = await this.web3AuthService.getUserAddress({
        authConnectionId: payload.authConnectionId,
        idToken: payload.idToken,
        userId: payload.userId,
      });

      this.logger.log(`EOA Address: ${eoaAddress}`);

      // Extract user ID from idToken or use provided userId
      // For now, we'll use the EOA address as the unique identifier
      const web3AuthId = payload.userId || eoaAddress.toLowerCase();

      // Create or retrieve user in database
      const user = await this.prisma.user.upsert({
        where: { web3AuthId },
        create: {
          web3AuthId,
          verifier: payload.authConnectionId,
          email: payload.email,
          name: payload.name,
          eoaAddress,
        },
        update: {
          email: payload.email,
          name: payload.name,
          eoaAddress,
          lastLoginAt: new Date(),
        },
      });

      this.logger.log(`User record updated: ${user.id}`);

      return {
        user,
        eoaAddress,
      };
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a MetaMask Smart Account for the user
   * This gives them account abstraction capabilities:
   * - Gasless transactions via paymaster
   * - Batch operations
   * - Permission-based delegation
   */
  async createSmartAccount(params: {
    userId: string;
    authConnectionId: string;
    idToken: string;
  }): Promise<{
    smartAccountAddress: Address;
    implementation: string;
  }> {
    try {
      this.logger.log(`Creating smart account for user: ${params.userId}`);

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.eoaAddress) {
        throw new Error('User does not have an EOA address');
      }

      // Get user's viem account from Web3Auth
      // This will be used as the signer for the smart account
      const signerAccount = await this.web3AuthService.getUserAccount({
        authConnectionId: params.authConnectionId,
        idToken: params.idToken,
      });

      this.logger.log(`Got signer account: ${signerAccount.address}`);

      // Create public client for Monad
      const publicClient = createPublicClient({
        chain: monad,
        transport: http(process.env.MONAD_RPC_URL),
      });

      // Create MetaMask Smart Account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [signerAccount.address, [], [], []],
        deploySalt: '0x',
        signer: { account: signerAccount }, // Wrap viem account in signer config
      });

      const smartAccountAddress = smartAccount.address;

      this.logger.log(`Smart account created: ${smartAccountAddress}`);

      // Update user record with smart account address
      await this.prisma.user.update({
        where: { id: params.userId },
        data: {
          smartAccountAddress,
          smartAccountImplementation: Implementation.Hybrid,
        },
      });

      return {
        smartAccountAddress,
        implementation: Implementation.Hybrid,
      };
    } catch (error) {
      this.logger.error('Failed to create smart account:', error.message);
      throw error;
    }
  }

  /**
   * Get user's wallet client for blockchain operations
   * This allows the agent to sign transactions on behalf of the user
   */
  async getUserWalletClient(params: {
    userId: string;
    authConnectionId: string;
    idToken: string;
    chainId?: number;
  }) {
    try {
      const user = await this.getUserById(params.userId);

      if (!user) {
        throw new Error('User not found');
      }

      const walletClient = await this.web3AuthService.getUserWalletClient({
        authConnectionId: params.authConnectionId,
        idToken: params.idToken,
        chainId: params.chainId,
      });

      return walletClient;
    } catch (error) {
      this.logger.error('Failed to get wallet client:', error.message);
      throw error;
    }
  }

  /**
   * Get user by Web3Auth ID
   */
  async getUserByWeb3AuthId(web3AuthId: string) {
    return this.prisma.user.findUnique({
      where: { web3AuthId },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Store permission grant for user
   * This is called when a user grants permissions to the agent
   */
  async storePermission(payload: {
    userId: string;
    permissionContext: string;
    delegationManager: Address;
    expiresAt: Date;
    permissionType: string;
    metadata?: any;
  }) {
    return this.prisma.permission.create({
      data: {
        userId: payload.userId,
        permissionContext: payload.permissionContext,
        delegationManager: payload.delegationManager,
        expiresAt: payload.expiresAt,
        permissionType: payload.permissionType,
        metadata: payload.metadata,
      },
    });
  }

  /**
   * Get active permissions for a user
   */
  async getUserPermissions(userId: string) {
    return this.prisma.permission.findMany({
      where: {
        userId,
        expiresAt: {
          gte: new Date(),
        },
        revokedAt: null,
      },
    });
  }

  /**
   * Revoke a permission
   */
  async revokePermission(permissionId: string) {
    return this.prisma.permission.update({
      where: { id: permissionId },
      data: { revokedAt: new Date() },
    });
  }
}
