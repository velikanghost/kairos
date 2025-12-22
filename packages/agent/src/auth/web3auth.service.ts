import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3Auth } from '@web3auth/node-sdk';
import { createWalletClient, http, type WalletClient, type Address } from 'viem';
import { monad } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

@Injectable()
export class Web3AuthService implements OnModuleInit {
  private readonly logger = new Logger(Web3AuthService.name);
  private web3auth: Web3Auth;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * Initialize Web3Auth with server-side configuration
   */
  private async initialize() {
    try {
      const clientId = this.configService.get<string>('WEB3AUTH_CLIENT_ID');
      const web3AuthNetwork = this.configService.get<string>('WEB3AUTH_NETWORK') || 'sapphire_mainnet';

      if (!clientId) {
        throw new Error('WEB3AUTH_CLIENT_ID is not configured');
      }

      // Initialize Web3Auth - Node SDK is stateless, no chain config needed
      this.web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: web3AuthNetwork as any, // Type assertion for network string
        usePnPKey: false, // Use CoreKit key instead of PnP key
        enableLogging: process.env.NODE_ENV === 'development',
      });

      await this.web3auth.init();

      this.logger.log('✅ Web3Auth initialized successfully');
      this.logger.log(`Network: ${web3AuthNetwork}`);
    } catch (error) {
      this.logger.error('Failed to initialize Web3Auth:', error.message);
      throw error;
    }
  }

  /**
   * Connect a user with their ID token from frontend
   * This derives the user's private key from Web3Auth's MPC network
   *
   * @param authConnectionId - The auth connection ID from Web3Auth Dashboard (e.g., 'google-oauth', 'custom-jwt')
   * @param idToken - The JWT token from the authentication provider
   * @param userId - Optional: Specify custom user ID (uses 'sub' from JWT by default)
   * @param userIdField - Optional: Which field to use for user ID (default: 'sub')
   * @param isUserIdCaseSensitive - Optional: Whether user ID is case sensitive (default: false)
   */
  async connectUser(params: {
    authConnectionId: string;
    idToken: string;
    userId?: string;
    userIdField?: string;
    isUserIdCaseSensitive?: boolean;
  }) {
    try {
      const result = await this.web3auth.connect({
        authConnectionId: params.authConnectionId,
        idToken: params.idToken,
        userId: params.userId,
        userIdField: params.userIdField,
        isUserIdCaseSensitive: params.isUserIdCaseSensitive ?? false,
      });

      this.logger.log(`User connected via ${params.authConnectionId}`);

      return result;
    } catch (error) {
      this.logger.error('Failed to connect user:', error.message);
      throw error;
    }
  }

  /**
   * Get user's private key from Web3Auth
   * IMPORTANT: Handle with extreme care - never log or expose this
   */
  async getUserPrivateKey(params: {
    authConnectionId: string;
    idToken: string;
    userId?: string;
  }): Promise<`0x${string}`> {
    try {
      const result = await this.connectUser(params);

      // The result contains a signer which has the private key
      // For EVM chains, this will be an ethers.js Wallet
      const signer = result.signer as any;

      if (!signer || !signer.privateKey) {
        throw new Error('No private key available from Web3Auth');
      }

      const privateKey = signer.privateKey as `0x${string}`;

      return privateKey;
    } catch (error) {
      this.logger.error('Failed to get user private key');
      throw error;
    }
  }

  /**
   * Get user's viem account from Web3Auth
   * This can be used to sign transactions with viem
   */
  async getUserAccount(params: {
    authConnectionId: string;
    idToken: string;
    userId?: string;
  }) {
    try {
      const privateKey = await this.getUserPrivateKey(params);
      const account = privateKeyToAccount(privateKey);

      this.logger.log(`Created viem account for address: ${account.address}`);

      return account;
    } catch (error) {
      this.logger.error('Failed to get user account:', error.message);
      throw error;
    }
  }

  /**
   * Get user's Ethereum address
   */
  async getUserAddress(params: {
    authConnectionId: string;
    idToken: string;
    userId?: string;
  }): Promise<Address> {
    try {
      const account = await this.getUserAccount(params);
      return account.address;
    } catch (error) {
      this.logger.error('Failed to get user address:', error.message);
      throw error;
    }
  }

  /**
   * Create a viem wallet client for the user
   * This can be used to send transactions on behalf of the user
   */
  async getUserWalletClient(params: {
    authConnectionId: string;
    idToken: string;
    userId?: string;
  }): Promise<WalletClient> {
    try {
      const account = await this.getUserAccount(params);

      const walletClient = createWalletClient({
        account,
        chain: monad,
        transport: http(process.env.MONAD_RPC_URL),
      });

      this.logger.log(`Created wallet client for chain: ${monad.name}`);

      return walletClient;
    } catch (error) {
      this.logger.error('Failed to create wallet client:', error.message);
      throw error;
    }
  }

  /**
   * Get the Web3Auth instance
   */
  getWeb3Auth() {
    return this.web3auth;
  }
}
