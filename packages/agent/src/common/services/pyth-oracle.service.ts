import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for fetching real-time and historical price data
 * - Real-time: Pyth Network Oracle via Hermes API
 * - Historical: CoinGecko API
 *
 * Sources:
 * - https://docs.pyth.network/price-feeds/core/fetch-price-updates
 * - https://docs.coingecko.com/reference/coins-id-market-chart-range
 */
@Injectable()
export class PythOracleService {
  private readonly logger = new Logger(PythOracleService.name);

  // Pyth Hermes API endpoint
  private readonly HERMES_API = 'https://hermes.pyth.network';

  // CoinGecko API endpoint
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  // Pyth Price Feed IDs
  // Source: https://www.pyth.network/price-feeds
  private readonly PRICE_FEED_IDS = {
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  };

  // CoinGecko coin IDs
  private readonly COINGECKO_IDS = {
    'ETH/USD': 'ethereum',
    'BTC/USD': 'bitcoin',
    'SOL/USD': 'solana',
  };

  // Maximum acceptable price age in seconds
  private readonly MAX_PRICE_AGE_SECONDS = 60;

  private readonly coinGeckoApiKey: string;

  // Cache for historical prices to avoid hitting rate limits
  private historicalPricesCache: Map<string, { prices: number[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  constructor(private configService: ConfigService) {
    this.coinGeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY') || '';
    this.logger.log('Pyth Oracle service initialized with Hermes API and CoinGecko');
  }

  /**
   * Get current ETH/USD price from Pyth Hermes API
   *
   * @returns Price in USD (e.g., 3000.50 for $3000.50)
   * @throws Error if price fetch fails or price is too stale
   */
  async getEthUsdPrice(): Promise<number> {
    return this.getPrice('ETH/USD');
  }

  /**
   * Get price for any supported pair from Hermes API
   *
   * @param symbol - Trading pair symbol (e.g., 'ETH/USD', 'BTC/USD', 'SOL/USD')
   * @returns Price in USD
   * @throws Error if price fetch fails or price is too stale
   */
  async getPrice(symbol: string): Promise<number> {
    const priceId = this.PRICE_FEED_IDS[symbol];

    if (!priceId) {
      throw new Error(`Price feed not found for symbol: ${symbol}`);
    }

    try {
      // Fetch latest price from Hermes API
      const url = `${this.HERMES_API}/v2/updates/price/latest?ids[]=${priceId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.parsed || data.parsed.length === 0) {
        throw new Error(`No price data returned for ${symbol}`);
      }

      const priceData = data.parsed[0];

      // Convert price with exponent
      const price = BigInt(priceData.price.price);
      const expo = priceData.price.expo;
      const actualPrice = Number(price) * Math.pow(10, expo);

      const conf = BigInt(priceData.price.conf);
      const confidence = Number(conf) * Math.pow(10, expo);

      const publishTime = priceData.price.publish_time;
      const ageSeconds = Math.floor(Date.now() / 1000) - publishTime;

      // Validate price freshness
      if (ageSeconds > this.MAX_PRICE_AGE_SECONDS) {
        throw new Error(
          `Price for ${symbol} is too stale: ${ageSeconds}s old (max: ${this.MAX_PRICE_AGE_SECONDS}s)`
        );
      }

      this.logger.log(
        `${symbol} from Pyth: $${actualPrice.toFixed(2)} (±$${confidence.toFixed(2)}, ${ageSeconds}s old)`,
      );

      return actualPrice;
    } catch (error) {
      this.logger.error(`Failed to fetch ${symbol} price from Pyth Hermes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get historical prices from CoinGecko API
   * Implements caching to avoid rate limits
   *
   * @param symbol - Trading pair symbol (e.g., 'ETH/USD')
   * @param hours - Number of hours of historical data to fetch
   * @returns Array of prices in USD
   */
  async getHistoricalPrices(symbol: string, hours: number = 24): Promise<number[]> {
    const cacheKey = `${symbol}-${hours}h`;

    // Check cache first
    const cached = this.historicalPricesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      this.logger.log(`Using cached historical prices for ${symbol} (${hours}h)`);
      return cached.prices;
    }

    const coinId = this.COINGECKO_IDS[symbol];

    if (!coinId) {
      throw new Error(`CoinGecko ID not found for symbol: ${symbol}`);
    }

    try {
      const toTimestamp = Math.floor(Date.now() / 1000);
      const fromTimestamp = toTimestamp - (hours * 3600);

      // CoinGecko market_chart/range endpoint
      // Returns prices at ~5 minute intervals
      const url = `${this.COINGECKO_API}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      // Add API key if available (for higher rate limits)
      // CoinGecko uses x-cg-demo-api-key for demo/free tier
      if (this.coinGeckoApiKey) {
        headers['x-cg-demo-api-key'] = this.coinGeckoApiKey;
      }

      this.logger.log(`Requesting CoinGecko: ${url.substring(0, 100)}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // Log the response body for debugging
        const errorBody = await response.text();
        this.logger.error(`CoinGecko API response: ${errorBody}`);
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.prices || data.prices.length === 0) {
        throw new Error(`No price data returned for ${symbol} from CoinGecko`);
      }

      // CoinGecko returns [[timestamp_ms, price], ...]
      const prices = data.prices.map(([_timestamp, price]: [number, number]) => price);

      this.logger.log(
        `Fetched ${prices.length} historical prices for ${symbol} from CoinGecko (${hours}h range)`
      );
      this.logger.log(
        `Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`
      );

      // Cache the result
      this.historicalPricesCache.set(cacheKey, {
        prices,
        timestamp: Date.now(),
      });

      return prices;
    } catch (error) {
      this.logger.error(`Failed to fetch historical ${symbol} prices from CoinGecko: ${error.message}`);
      throw error;
    }
  }
}
