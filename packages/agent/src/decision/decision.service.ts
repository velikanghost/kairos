import { Injectable, Logger } from '@nestjs/common';
import { DCAStrategy } from '@prisma/client';
import { IndicatorsService } from '../indicators/indicators.service';
import { IndexerService } from '../indexer/indexer.service';
import { ExecutionDecision } from '../common/types';
import { clamp } from '../common/utils/math.utils';

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(
    private indicatorsService: IndicatorsService,
    private indexerService: IndexerService,
  ) {}

  /**
   * Main decision engine - determines if and how to execute a DCA strategy
   */
  async shouldExecute(strategy: DCAStrategy): Promise<ExecutionDecision> {
    this.logger.log(`Evaluating strategy ${strategy.id} for execution`);

    try {
      // Get current market indicators
      const indicators = await this.indicatorsService.analyzeMarket(strategy.pairId);
      const currentPrice = await this.indexerService.getCurrentPrice(strategy.pairId);

      if (!currentPrice) {
        this.logger.warn('No price data available, skipping execution');
        return {
          shouldExecute: false,
          recommendedAmount: 0n,
          reason: 'No price data available',
          confidence: 0,
          indicators: {
            price: 0,
            volatility: indicators.volatility,
            liquidity: indicators.liquidityScore,
            trend: indicators.trend,
          },
        };
      }

      // Calculate base amount
      const baseAmount = BigInt(strategy.baseAmount);

      // Check if smart sizing is enabled
      let recommendedAmount = baseAmount;
      if (strategy.enableSmartSizing) {
        recommendedAmount = this.calculateSmartAmount(baseAmount, indicators, strategy);
      }

      // Get buy recommendation
      const buyDecision = this.indicatorsService.shouldBuy(indicators);

      // Make final decision
      const shouldExecute = buyDecision.should && indicators.liquidityScore > 0.2;

      return {
        shouldExecute,
        recommendedAmount,
        reason: buyDecision.reason,
        confidence: buyDecision.confidence,
        indicators: {
          price: currentPrice.price,
          volatility: indicators.volatility,
          liquidity: indicators.liquidityScore,
          trend: indicators.trend,
          volume24h: 0, // Can be enhanced
        },
      };
    } catch (error) {
      this.logger.error(`Error in shouldExecute: ${error.message}`);
      return {
        shouldExecute: false,
        recommendedAmount: 0n,
        reason: `Error: ${error.message}`,
        confidence: 0,
        indicators: {
          price: 0,
          volatility: 0,
          liquidity: 0,
          trend: 'neutral',
        },
      };
    }
  }

  /**
   * Calculate smart amount based on market conditions
   */
  private calculateSmartAmount(
    baseAmount: bigint,
    indicators: any,
    strategy: DCAStrategy,
  ): bigint {
    let multiplier = 1.0;

    // Volatility adjustment
    if (strategy.enableVolatilityAdjustment) {
      if (indicators.volatility < 2) {
        // Low volatility - can increase size slightly
        multiplier *= 1.1;
      } else if (indicators.volatility > 10) {
        // High volatility - reduce size
        multiplier *= 0.7;
      }
    }

    // Price dip adjustment (buy more on dips)
    if (indicators.priceChange24h < -10) {
      multiplier *= 1.3; // 30% more on significant dip
    } else if (indicators.priceChange24h < -5) {
      multiplier *= 1.15; // 15% more on moderate dip
    }

    // Liquidity adjustment
    if (strategy.enableLiquidityCheck) {
      if (indicators.liquidityScore < 0.3) {
        multiplier *= 0.5; // Reduce size if liquidity is low
      } else if (indicators.liquidityScore > 0.8) {
        multiplier *= 1.1; // Slightly increase if liquidity is high
      }
    }

    // Clamp multiplier between 0.5x and 2x
    multiplier = clamp(multiplier, 0.5, 2.0);

    // Calculate final amount
    const adjustedAmount = Number(baseAmount) * multiplier;
    return BigInt(Math.floor(adjustedAmount));
  }

  /**
   * Assess risk level of execution
   */
  assessRisk(indicators: any): 'low' | 'medium' | 'high' {
    // High volatility = high risk
    if (indicators.volatility > 15) return 'high';

    // Low liquidity = high risk
    if (indicators.liquidityScore < 0.2) return 'high';

    // Moderate volatility and liquidity = medium risk
    if (indicators.volatility > 5 || indicators.liquidityScore < 0.5) {
      return 'medium';
    }

    return 'low';
  }
}
