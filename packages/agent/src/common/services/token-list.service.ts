import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface Token {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  extensions?: {
    bridgeInfo?: Record<string, any>;
  };
}

export interface TokenList {
  name: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: Token[];
}

@Injectable()
export class TokenListService implements OnModuleInit {
  private readonly logger = new Logger(TokenListService.name);
  private tokenCache: Map<string, Token> = new Map();
  private tokenList: TokenList | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 3600000; // 1 hour in ms
  private readonly TOKEN_LIST_URL = 'https://raw.githubusercontent.com/monad-crypto/token-list/refs/heads/main/tokenlist-mainnet.json';

  constructor() {}

  async onModuleInit() {
    // Fetch token list on startup
    await this.fetchTokenList();
  }

  /**
   * Fetch the token list from GitHub
   */
  private async fetchTokenList(): Promise<void> {
    try {
      this.logger.log('Fetching Monad token list...');

      const response = await fetch(this.TOKEN_LIST_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch token list: ${response.statusText}`);
      }

      const data = await response.json();
      this.tokenList = data;
      this.lastFetch = Date.now();

      // Build token cache (indexed by lowercase address)
      this.tokenCache.clear();
      if (this.tokenList && this.tokenList.tokens) {
        this.tokenList.tokens.forEach(token => {
          this.tokenCache.set(token.address.toLowerCase(), token);
          // Also index by symbol for easy lookup
          this.tokenCache.set(token.symbol.toLowerCase(), token);
        });

        this.logger.log(`Loaded ${this.tokenList.tokens.length} tokens from token list v${this.tokenList.version.major}.${this.tokenList.version.minor}.${this.tokenList.version.patch}`);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch token list: ${error.message}`);
    }
  }

  /**
   * Get token by address or symbol
   */
  async getToken(addressOrSymbol: string): Promise<Token | null> {
    await this.ensureFreshCache();
    return this.tokenCache.get(addressOrSymbol.toLowerCase()) || null;
  }

  /**
   * Get all tokens
   */
  async getAllTokens(): Promise<Token[]> {
    await this.ensureFreshCache();
    return this.tokenList?.tokens || [];
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(addressOrSymbol: string): Promise<number | null> {
    const token = await this.getToken(addressOrSymbol);
    return token?.decimals || null;
  }

  /**
   * Get token symbol
   */
  async getTokenSymbol(address: string): Promise<string | null> {
    const token = await this.getToken(address);
    return token?.symbol || null;
  }

  /**
   * Get token name
   */
  async getTokenName(addressOrSymbol: string): Promise<string | null> {
    const token = await this.getToken(addressOrSymbol);
    return token?.name || null;
  }

  /**
   * Parse pair ID (e.g., "MON-USDC") and return token details
   */
  async parsePair(pairId: string): Promise<{ base: Token; quote: Token } | null> {
    const [baseSymbol, quoteSymbol] = pairId.split('-').map(s => s.trim());

    const base = await this.getToken(baseSymbol);
    const quote = await this.getToken(quoteSymbol);

    if (!base || !quote) {
      this.logger.warn(`Could not find tokens for pair: ${pairId}`);
      return null;
    }

    return { base, quote };
  }

  /**
   * Ensure cache is fresh, refetch if stale
   */
  private async ensureFreshCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetch > this.CACHE_DURATION) {
      await this.fetchTokenList();
    }
  }

  /**
   * Manually refresh the token list
   */
  async refresh(): Promise<void> {
    await this.fetchTokenList();
  }
}
