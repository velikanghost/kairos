import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient, gql } from 'graphql-request';
import { PriceData, VolumeData, LiquidityData, SwapEvent } from '../common/types';
import { PythOracleService } from '../common/services/pyth-oracle.service';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly client: GraphQLClient;

  constructor(
    private configService: ConfigService,
    private pythOracle: PythOracleService,
  ) {
    const graphqlUrl = this.configService.get<string>('indexer.graphqlUrl') || 'http://localhost:8080/v1/graphql';
    this.client = new GraphQLClient(graphqlUrl);
    this.logger.log(`Indexer GraphQL client initialized: ${graphqlUrl}`);
  }

  /**
   * Get current price from Pyth oracle
   * Uses Pyth Network for accurate, real-time ETH/USD price
   */
  async getCurrentPrice(pairId: string): Promise<PriceData | null> {
    try {
      // Get real ETH/USD price from Pyth oracle
      const price = await this.pythOracle.getEthUsdPrice();

      // Get latest swap data for block/timestamp info
      const query = gql`
        query GetLatestSwap($limit: Int!) {
          PoolManager_Swap(limit: $limit, order_by: {timestamp: desc}) {
            sqrtPriceX96
            blockNumber
            timestamp
          }
        }
      `;

      const data: any = await this.client.request(query, { limit: 1 });
      const swaps = data.PoolManager_Swap;

      if (!swaps || swaps.length === 0) {
        this.logger.warn(`No swaps found for ${pairId}, using current time`);
        return {
          price,
          sqrtPriceX96: 0n,
          blockNumber: 0,
          timestamp: Math.floor(Date.now() / 1000),
        };
      }

      const latestSwap = swaps[0];

      return {
        price,
        sqrtPriceX96: BigInt(latestSwap.sqrtPriceX96),
        blockNumber: parseInt(latestSwap.blockNumber),
        timestamp: parseInt(latestSwap.timestamp),
      };
    } catch (error) {
      this.logger.error(`Error fetching current price: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get historical prices for a time range
   * Uses CoinGecko API for real ETH/USD prices
   */
  async getHistoricalPrices(hours: number = 24): Promise<number[]> {
    this.logger.log(`Fetching historical ETH/USD prices from CoinGecko for last ${hours}h`);

    try {
      // Use Pyth Oracle service to fetch from CoinGecko
      const prices = await this.pythOracle.getHistoricalPrices('ETH/USD', hours);
      return prices;
    } catch (error) {
      this.logger.error(`Failed to fetch historical prices: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent swaps for analysis
   */
  async getRecentSwaps(limit: number = 100): Promise<SwapEvent[]> {
    const query = gql`
      query GetRecentSwaps($limit: Int!) {
        PoolManager_Swap(
          limit: $limit
          order_by: {timestamp: desc}
        ) {
          id
          event_id
          sender
          amount0
          amount1
          sqrtPriceX96
          liquidity
          tick
          fee
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const data: any = await this.client.request(query, { limit });
      const swaps = data.PoolManager_Swap || [];

      return swaps.map((swap: any) => ({
        id: swap.id,
        event_id: swap.event_id,
        sender: swap.sender,
        amount0: BigInt(swap.amount0),
        amount1: BigInt(swap.amount1),
        sqrtPriceX96: BigInt(swap.sqrtPriceX96),
        liquidity: BigInt(swap.liquidity),
        tick: parseInt(swap.tick),
        fee: parseInt(swap.fee),
        blockNumber: parseInt(swap.blockNumber),
        timestamp: parseInt(swap.timestamp),
      }));
    } catch (error) {
      this.logger.error(`Error fetching recent swaps: ${error.message}`);
      return [];
    }
  }

  /**
   * Get 24h volume data from Uniswap V4 swaps
   */
  async get24hVolume(): Promise<VolumeData> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgo = nowSeconds - 86400;
    const twoDaysAgo = nowSeconds - 172800;

    const query = gql`
      query Get24hVolume {
        PoolManager_Swap {
          amount0
          amount1
          timestamp
        }
      }
    `;

    this.logger.log(`Fetching all swaps for 24h volume calculation (oneDayAgo: ${oneDayAgo}, twoDaysAgo: ${twoDaysAgo})`);

    const data: any = await this.client.request(query);
    const allSwaps = data.PoolManager_Swap || [];

    this.logger.log(`Retrieved ${allSwaps.length} swaps for volume calculation`);

    // Filter client-side
    const last24h = allSwaps.filter((swap: any) => parseInt(swap.timestamp) >= oneDayAgo);
    const previous24h = allSwaps.filter((swap: any) => {
      const ts = parseInt(swap.timestamp);
      return ts >= twoDaysAgo && ts < oneDayAgo;
    });

    this.logger.log(`Last 24h: ${last24h.length} swaps, Previous 24h: ${previous24h.length} swaps`);

    const last24hVolume = this.calculateTotalVolume(last24h);
    const previous24hVolume = this.calculateTotalVolume(previous24h);

    const volumeChange = previous24hVolume > 0
      ? ((last24hVolume - previous24hVolume) / previous24hVolume) * 100
      : 0;

    return {
      volume24h: last24hVolume,
      volumeChange,
      swapCount: last24h.length,
    };
  }

  /**
   * Get pool liquidity data from Uniswap V4 ModifyLiquidity events
   */
  async getPoolLiquidity(): Promise<LiquidityData> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgo = nowSeconds - 86400;
    const sevenDaysAgo = nowSeconds - 604800;

    const query = gql`
      query GetPoolLiquidity {
        PoolManager_ModifyLiquidity {
          liquidityDelta
          timestamp
        }
      }
    `;

    try {
      const data: any = await this.client.request(query);
      const liquidityEvents = data.PoolManager_ModifyLiquidity || [];

      this.logger.log(`Retrieved ${liquidityEvents.length} liquidity modification events`);

      // Calculate total liquidity by summing all deltas
      const totalLiquidity: bigint = liquidityEvents.reduce((sum: bigint, event: any) => {
        const delta = BigInt(event.liquidityDelta);
        return sum + delta;
      }, 0n);

      // Calculate 24h net flow
      const events24h = liquidityEvents.filter((e: any) => parseInt(e.timestamp) >= oneDayAgo);
      const netFlow24h = events24h.reduce((sum: bigint, e: any) => sum + BigInt(e.liquidityDelta), 0n);

      // Calculate 7d net flow
      const events7d = liquidityEvents.filter((e: any) => parseInt(e.timestamp) >= sevenDaysAgo);
      const netFlow7d = events7d.reduce((sum: bigint, e: any) => sum + BigInt(e.liquidityDelta), 0n);

      // Liquidity score: based on flow momentum as percentage of total liquidity
      let liquidityScore = 0.5; // Base score (neutral)

      if (totalLiquidity > 0n) {
        const flow24hPercent = (Number(netFlow24h) / Number(totalLiquidity)) * 100;
        const flow7dPercent = (Number(netFlow7d) / Number(totalLiquidity)) * 100;

        const flowImpact = (flow24hPercent * 0.06) + (flow7dPercent * 0.04);

        liquidityScore = 0.5 + flowImpact;
        liquidityScore = Math.max(0, Math.min(1, liquidityScore));

        this.logger.log(`Flow analysis - 24h: ${flow24hPercent.toFixed(3)}%, 7d: ${flow7dPercent.toFixed(3)}%, Impact: ${flowImpact.toFixed(4)}`);
      }

      this.logger.log(`Pool liquidity - Total: ${totalLiquidity.toString()}, 24h flow: ${netFlow24h.toString()}, 7d flow: ${netFlow7d.toString()}, Score: ${liquidityScore.toFixed(4)}`);

      return {
        totalLiquidity,
        liquidityScore,
      };
    } catch (error) {
      this.logger.error(`Error fetching pool liquidity: ${error.message}`);
      return { totalLiquidity: 0n, liquidityScore: 0 };
    }
  }

  /**
   * Helper to calculate total volume from Uniswap V4 swaps
   */
  private calculateTotalVolume(swaps: any[]): number {
    return swaps.reduce((total, swap) => {
      const amount0 = Math.abs(Number(swap.amount0));
      const amount1 = Math.abs(Number(swap.amount1));
      return total + amount0 + amount1;
    }, 0);
  }
}
