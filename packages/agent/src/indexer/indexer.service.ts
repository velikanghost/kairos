import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient, gql } from 'graphql-request';
import { PriceData, VolumeData, LiquidityData, SwapEvent } from '../common/types';

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly client: GraphQLClient;

  constructor(private configService: ConfigService) {
    const graphqlUrl = this.configService.get<string>('indexer.graphqlUrl') || 'http://localhost:8080/v1/graphql';
    this.client = new GraphQLClient(graphqlUrl);
    this.logger.log(`Indexer GraphQL client initialized: ${graphqlUrl}`);
  }

  /**
   * Get current price from latest swap
   */
  async getCurrentPrice(pairId: string): Promise<PriceData | null> {
    const query = gql`
      query GetLatestSwap {
        KuruDexRouter_KuruRouterSwap {
          amountIn
          amountOut
          debitToken
          creditToken
          blockNumber
          timestamp
        }
      }
    `;

    try {
      const data: any = await this.client.request(query);
      const swaps = data.KuruDexRouter_KuruRouterSwap;

      if (!swaps || swaps.length === 0) {
        this.logger.warn(`No swaps found for pair: ${pairId}`);
        return null;
      }

      // Sort by timestamp descending to get latest
      const sortedSwaps = swaps.sort((a: any, b: any) => parseInt(b.timestamp) - parseInt(a.timestamp));
      const latestSwap = sortedSwaps[0];

      // Calculate price as amountOut / amountIn
      const amountIn = Number(latestSwap.amountIn);
      const amountOut = Number(latestSwap.amountOut);
      const price = amountOut / amountIn;

      return {
        price,
        sqrtPriceX96: 0n, // Not applicable for KuruDex
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
   */
  async getHistoricalPrices(hours: number = 24): Promise<number[]> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const startTime = nowSeconds - hours * 3600;

    // Fetch ALL swaps without limit
    const query = gql`
      query GetHistoricalSwaps {
        KuruDexRouter_KuruRouterSwap {
          amountIn
          amountOut
          timestamp
        }
      }
    `;

    this.logger.log(`Fetching all swaps, then filtering for last ${hours}h (timestamp >= ${startTime})`);

    const data: any = await this.client.request(query);
    const swaps = data.KuruDexRouter_KuruRouterSwap || [];

    this.logger.log(`Retrieved ${swaps.length} total swaps from indexer`);

    // Filter by timestamp client-side
    const filteredSwaps = swaps.filter((swap: any) => parseInt(swap.timestamp) >= startTime);

    this.logger.log(`Filtered to ${filteredSwaps.length} swaps within ${hours}h timeframe`);

    // Sort by timestamp (ascending order - oldest to newest)
    const sortedSwaps = filteredSwaps.sort((a: any, b: any) => parseInt(a.timestamp) - parseInt(b.timestamp));

    return sortedSwaps.map((swap: any) => {
      const amountIn = Number(swap.amountIn);
      const amountOut = Number(swap.amountOut);
      return amountOut / amountIn;
    });
  }

  /**
   * Get recent swaps for analysis
   */
  async getRecentSwaps(limit: number = 100): Promise<SwapEvent[]> {
    const query = gql`
      query GetRecentSwaps($limit: Int!) {
        PoolManager_Swap(
          limit: $limit
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

      // Sort by timestamp manually since order_by has DB issues
      const sortedSwaps = swaps.sort((a: any, b: any) => parseInt(b.timestamp) - parseInt(a.timestamp));

      return sortedSwaps.map((swap: any) => ({
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
   * Get 24h volume data
   */
  async get24hVolume(): Promise<VolumeData> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgo = nowSeconds - 86400;
    const twoDaysAgo = nowSeconds - 172800;

    // Fetch ALL swaps
    const query = gql`
      query Get24hVolume {
        KuruDexRouter_KuruRouterSwap {
          amountIn
          amountOut
          timestamp
        }
      }
    `;

    this.logger.log(`Fetching all swaps for 24h volume calculation (oneDayAgo: ${oneDayAgo}, twoDaysAgo: ${twoDaysAgo})`);

    const data: any = await this.client.request(query);
    const allSwaps = data.KuruDexRouter_KuruRouterSwap || [];

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
   * Get pool liquidity data
   */
  async getPoolLiquidity(): Promise<LiquidityData> {
    const query = gql`
      query GetLiquidity {
        PoolManager_ModifyLiquidity(
          limit: 100
          order_by: { timestamp: desc }
        ) {
          liquidityDelta
          tickLower
          tickUpper
        }
      }
    `;

    try {
      const data: any = await this.client.request(query);
      const modifications = data.PoolManager_ModifyLiquidity || [];

      // Sum up all liquidity deltas
      let totalLiquidity = 0n;
      modifications.forEach((mod: any) => {
        totalLiquidity += BigInt(mod.liquidityDelta);
      });

      // Simple liquidity score (can be enhanced)
      const liquidityScore = totalLiquidity > 0n ? Math.min(1, Number(totalLiquidity) / 1e18) : 0;

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
   * Helper to calculate total volume from swaps
   */
  private calculateTotalVolume(swaps: any[]): number {
    return swaps.reduce((total, swap) => {
      // For KuruDex, sum amountIn and amountOut
      const amountIn = Math.abs(Number(swap.amountIn));
      const amountOut = Math.abs(Number(swap.amountOut));
      return total + amountIn + amountOut;
    }, 0);
  }
}
