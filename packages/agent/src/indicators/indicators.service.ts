import { Injectable, Logger } from '@nestjs/common';
import { IndexerService } from '../indexer/indexer.service';
import { Indicators } from '../common/types';
import {
  calculateMovingAverage,
  calculateVolatility,
  isVolumeSpike,
  percentageChange,
} from '../common/utils/math.utils';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);

  constructor(private indexerService: IndexerService) {}

  /**
   * Analyze market conditions and return all indicators
   */
  async analyzeMarket(pairId: string): Promise<Indicators> {
    this.logger.log(`Analyzing market for pair: ${pairId}`);

    // Fetch data from indexer - let errors propagate
    const [currentPrice, prices24h, prices7d, prices30d, volumeData, liquidityData] =
      await Promise.all([
        this.indexerService.getCurrentPrice(pairId),
        this.indexerService.getHistoricalPrices(24),
        this.indexerService.getHistoricalPrices(24 * 7),
        this.indexerService.getHistoricalPrices(24 * 30),
        this.indexerService.get24hVolume(),
        this.indexerService.getPoolLiquidity(),
      ]);

    if (!currentPrice) {
      throw new Error('No current price data available');
    }

    if (prices24h.length === 0) {
      throw new Error('No historical price data available for the last 24 hours');
    }

    // Calculate volatility from recent prices
    const volatility = calculateVolatility(prices24h);

    // Calculate moving averages
    const ma7 = calculateMovingAverage(prices7d, 7);
    const ma30 = calculateMovingAverage(prices30d, 30);

    // Determine trend
    const trend = this.determineTrend(currentPrice.price, ma7, ma30);

    // Calculate 24h price change
    const price24hAgo = prices24h[0];
    const priceChange24h = percentageChange(price24hAgo, currentPrice.price);

    // Calculate volume ratio (current vs average)
    const avgVolume = volumeData.volume24h > 0 ? volumeData.volume24h : 1;
    const volumeRatio = volumeData.swapCount > 0 ? volumeData.volume24h / avgVolume : 1;

    this.logger.log(`Market analysis complete: volatility=${volatility.toFixed(2)}, ma7=${ma7?.toFixed(8)}, ma30=${ma30?.toFixed(8)}, trend=${trend}, priceChange24h=${priceChange24h.toFixed(2)}%, liquidityScore=${liquidityData.liquidityScore}`);

    return {
      volatility,
      ma7: ma7 ?? undefined,
      ma30: ma30 ?? undefined,
      trend,
      priceChange24h,
      volumeRatio,
      liquidityScore: liquidityData.liquidityScore,
    };
  }

  /**
   * Determine market trend based on price and moving averages
   */
  private determineTrend(
    currentPrice: number,
    ma7: number | null,
    ma30: number | null,
  ): 'bullish' | 'bearish' | 'neutral' {
    if (!ma7 || !ma30) return 'neutral';

    // Golden cross: MA7 > MA30 and price > MA7 = Bullish
    if (ma7 > ma30 && currentPrice > ma7) {
      return 'bullish';
    }

    // Death cross: MA7 < MA30 and price < MA7 = Bearish
    if (ma7 < ma30 && currentPrice < ma7) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * Get default indicators when data is insufficient
   */
  private getDefaultIndicators(): Indicators {
    return {
      volatility: 0,
      ma7: undefined,
      ma30: undefined,
      trend: 'neutral',
      priceChange24h: 0,
      volumeRatio: 1,
      liquidityScore: 0,
    };
  }

  /**
   * Check if it's a good time to buy based on indicators
   */
  shouldBuy(indicators: Indicators): { should: boolean; reason: string; confidence: number } {
    const reasons: string[] = [];
    let score = 0.5; // Start neutral

    // Volatility check (prefer moderate volatility)
    if (indicators.volatility < 2) {
      reasons.push('Low volatility detected');
      score += 0.1;
    } else if (indicators.volatility > 10) {
      reasons.push('High volatility - reducing confidence');
      score -= 0.2;
    }

    // Price trend check
    if (indicators.trend === 'bullish') {
      reasons.push('Bullish trend detected');
      score += 0.2;
    } else if (indicators.trend === 'bearish') {
      reasons.push('Bearish trend - good buying opportunity');
      score += 0.1; // Still buy on dips for DCA
    }

    // Price dip check (good for DCA)
    if (indicators.priceChange24h < -5) {
      reasons.push(`Price dipped ${indicators.priceChange24h.toFixed(2)}%`);
      score += 0.3;
    }

    // Liquidity check
    if (indicators.liquidityScore < 0.3) {
      reasons.push('Low liquidity - reducing size');
      score -= 0.2;
    } else if (indicators.liquidityScore > 0.7) {
      reasons.push('Good liquidity available');
      score += 0.1;
    }

    // Volume check
    if (indicators.volumeRatio > 2) {
      reasons.push('High volume spike detected');
      score -= 0.1; // Wait for stabilization
    }

    const should = score > 0.4; // Threshold for execution
    const confidence = Math.max(0, Math.min(1, score));

    return {
      should,
      reason: reasons.join(', ') || 'Normal market conditions',
      confidence,
    };
  }
}
