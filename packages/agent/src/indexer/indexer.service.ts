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
   * Get pool liquidity data from KuruMarginAccount
   */
  async getPoolLiquidity(): Promise<LiquidityData> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const oneDayAgo = nowSeconds - 86400;
    const sevenDaysAgo = nowSeconds - 604800;

    const query = gql`
      query GetMarginAccountLiquidity {
        deposits: KuruMarginAccount_Deposit {
          amount
          token
          timestamp
        }
        withdrawals: KuruMarginAccount_Withdrawal {
          amount
          token
          timestamp
        }
      }
    `;

    try {
      const data: any = await this.client.request(query);
      const deposits = data.deposits || [];
      const withdrawals = data.withdrawals || [];

      this.logger.log(`Retrieved ${deposits.length} deposits and ${withdrawals.length} withdrawals from margin accounts`);

      // Calculate total deposited across all tokens
      const totalDeposited: bigint = deposits.reduce((sum: bigint, d: any) => {
        return sum + BigInt(d.amount);
      }, 0n);

      // Calculate total withdrawn across all tokens
      const totalWithdrawn: bigint = withdrawals.reduce((sum: bigint, w: any) => {
        return sum + BigInt(w.amount);
      }, 0n);

      // Net liquidity = deposits - withdrawals
      const totalLiquidity: bigint = totalDeposited - totalWithdrawn;

      // Calculate 24h net flow (deposits - withdrawals in last 24h)
      const deposits24h = deposits.filter((d: any) => parseInt(d.timestamp) >= oneDayAgo);
      const withdrawals24h = withdrawals.filter((w: any) => parseInt(w.timestamp) >= oneDayAgo);

      const netFlow24h = deposits24h.reduce((sum: bigint, d: any) => sum + BigInt(d.amount), 0n) -
                         withdrawals24h.reduce((sum: bigint, w: any) => sum + BigInt(w.amount), 0n);

      // Calculate 7d net flow
      const deposits7d = deposits.filter((d: any) => parseInt(d.timestamp) >= sevenDaysAgo);
      const withdrawals7d = withdrawals.filter((w: any) => parseInt(w.timestamp) >= sevenDaysAgo);

      const netFlow7d = deposits7d.reduce((sum: bigint, d: any) => sum + BigInt(d.amount), 0n) -
                        withdrawals7d.reduce((sum: bigint, w: any) => sum + BigInt(w.amount), 0n);

      // Liquidity score: based on flow momentum as percentage of total liquidity
      // 0.5 = neutral, 1.0 = strong bullish, 0.0 = strong bearish
      let liquidityScore = 0.5; // Base score (neutral)

      if (totalLiquidity > 0n) {
        // Calculate flow as percentage of total liquidity
        const flow24hPercent = (Number(netFlow24h) / Number(totalLiquidity)) * 100;
        const flow7dPercent = (Number(netFlow7d) / Number(totalLiquidity)) * 100;

        // Each 1% flow change affects score by 0.1
        // So ±5% flow = ±0.5 score change (full range from 0 to 1)
        // Weight 24h flow more heavily than 7d
        const flowImpact = (flow24hPercent * 0.06) + (flow7dPercent * 0.04);

        liquidityScore = 0.5 + flowImpact;
        liquidityScore = Math.max(0, Math.min(1, liquidityScore)); // Clamp to [0, 1]

        this.logger.log(`Flow analysis - 24h: ${flow24hPercent.toFixed(3)}%, 7d: ${flow7dPercent.toFixed(3)}%, Impact: ${flowImpact.toFixed(4)}`);
      }

      this.logger.log(`Margin liquidity - Total: ${totalLiquidity.toString()}, 24h flow: ${netFlow24h.toString()}, 7d flow: ${netFlow7d.toString()}, Score: ${liquidityScore.toFixed(4)}`);

      return {
        totalLiquidity,
        liquidityScore,
      };
    } catch (error) {
      this.logger.error(`Error fetching margin account liquidity: ${error.message}`);
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
