import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { createPublicClient, http, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

@Injectable()
export class SessionAccountService {
  private readonly logger = new Logger(SessionAccountService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private config: ConfigService,
  ) {}

  /**
   * Get or create a session account for a user
   * If user already has an active session account, return it
   * Otherwise, generate a new one
   * Also creates user record if it doesn't exist (using wallet address)
   */
  async getOrCreateSessionAccount(walletAddress: string): Promise<{
    address: Address;
    implementation: string;
  }> {
    try {
      // Ensure user exists and get their ID (wallet address is passed in)
      const user = await this.ensureUserExists(walletAddress);

      // Check if user already has an active session account
      const existingSession = await this.prisma.sessionAccount.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      });

      if (existingSession) {
        this.logger.log(`Using existing session account: ${existingSession.address}`);
        return {
          address: existingSession.address as Address,
          implementation: existingSession.implementation,
        };
      }

      // Create new session account
      return this.createSessionAccount(user.id);
    } catch (error) {
      this.logger.error('Failed to get or create session account:', error.message);
      throw error;
    }
  }

  /**
   * Ensure user exists in database (create if not exists)
   * Uses wallet address as the primary identifier
   * Returns the user record with ID
   */
  private async ensureUserExists(walletAddress: string) {
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      this.logger.log(`Creating new user for wallet: ${walletAddress}`);
      user = await this.prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
        },
      });
    }

    return user;
  }

  /**
   * Create a new session account for a user
   * Generates a private key, creates MetaMask Smart Account, encrypts and stores the key
   */
  async createSessionAccount(userId: string): Promise<{
    address: Address;
    implementation: string;
  }> {
    try {
      this.logger.log(`Creating new session account for user: ${userId}`);

      // Generate a new private key
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      this.logger.log(`Generated EOA for session: ${account.address}`);

      // Create public client for Sepolia
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.config.get('blockchain.rpcUrl')),
      });

      // Create MetaMask Smart Account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [account.address, [], [], []],
        deploySalt: '0x',
        signer: { account },
      });

      const smartAccountAddress = smartAccount.address;

      this.logger.log(`Session smart account created: ${smartAccountAddress}`);

      // Encrypt the private key
      const encryptedPrivateKey = this.encryption.encrypt(privateKey);

      // Store in database (always lowercase addresses for consistent queries)
      await this.prisma.sessionAccount.create({
        data: {
          userId,
          address: smartAccountAddress.toLowerCase(),
          encryptedPrivateKey,
          implementation: Implementation.Hybrid,
          isActive: true,
        },
      });

      this.logger.log(`Session account stored in database`);

      return {
        address: smartAccountAddress,
        implementation: Implementation.Hybrid,
      };
    } catch (error) {
      this.logger.error('Failed to create session account:', error.message);
      throw error;
    }
  }

  /**
   * Get a session account's viem account (with decrypted private key)
   * Used for signing transactions
   */
  async getSessionAccountSigner(sessionAccountAddress: string) {
    try {
      const sessionAccount = await this.prisma.sessionAccount.findUnique({
        where: { address: sessionAccountAddress },
      });

      if (!sessionAccount) {
        throw new Error('Session account not found');
      }

      if (!sessionAccount.isActive) {
        throw new Error('Session account is inactive');
      }

      if (sessionAccount.expiresAt && sessionAccount.expiresAt < new Date()) {
        throw new Error('Session account has expired');
      }

      // Decrypt the private key
      const privateKey = this.encryption.decrypt(sessionAccount.encryptedPrivateKey);

      // Create viem account
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      return account;
    } catch (error) {
      this.logger.error('Failed to get session account signer:', error.message);
      throw error;
    }
  }

  /**
   * Get a session account's smart account (with signer)
   * Used for executing transactions
   * Returns the smart account instance that can sign and execute transactions
   */
  async getSessionSmartAccount(sessionAccountAddress: string) {
    try {
      const sessionAccount = await this.prisma.sessionAccount.findUnique({
        where: { address: sessionAccountAddress },
      });

      if (!sessionAccount) {
        throw new Error('Session account not found');
      }

      // Get the signer
      const signerAccount = await this.getSessionAccountSigner(sessionAccountAddress);

      // Create public client
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.config.get('blockchain.rpcUrl')),
      });

      // Recreate the smart account (same deployParams will generate same address)
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [signerAccount.address, [], [], []],
        deploySalt: '0x',
        signer: { account: signerAccount },
      });

      // Verify the address matches what we expect
      if (smartAccount.address.toLowerCase() !== sessionAccountAddress.toLowerCase()) {
        throw new Error(
          `Smart account address mismatch. Expected: ${sessionAccountAddress}, Got: ${smartAccount.address}`,
        );
      }

      return smartAccount;
    } catch (error) {
      this.logger.error('Failed to get session smart account:', error.message);
      throw error;
    }
  }

  /**
   * Deactivate a session account
   */
  async deactivateSessionAccount(sessionAccountAddress: string) {
    try {
      await this.prisma.sessionAccount.update({
        where: { address: sessionAccountAddress },
        data: { isActive: false },
      });

      this.logger.log(`Session account deactivated: ${sessionAccountAddress}`);
    } catch (error) {
      this.logger.error('Failed to deactivate session account:', error.message);
      throw error;
    }
  }

  /**
   * Get all active session accounts for a user
   * userId is actually the wallet address
   */
  async getUserSessionAccounts(walletAddress: string) {
    // Look up user by wallet address
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      return []; // No user, no session accounts
    }

    return this.prisma.sessionAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        address: true,
        implementation: true,
        expiresAt: true,
        createdAt: true,
        // Don't expose encrypted private key
      },
    });
  }
}
