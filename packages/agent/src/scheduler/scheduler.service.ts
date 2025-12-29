import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StrategiesService } from '../strategies/strategies.service';
import { DecisionService } from '../decision/decision.service';
import { ExecutionService } from '../execution/execution.service';
import { PrismaService } from '../prisma/prisma.service';
import { DCAStrategy } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private strategiesService: StrategiesService,
    private decisionService: DecisionService,
    private executionService: ExecutionService,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check strategies every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkStrategies() {
    this.logger.log('Checking for strategies due for execution...');

    try {
      const strategies = await this.strategiesService.findDueStrategies();

      if (strategies.length === 0) {
        this.logger.debug('No strategies due for execution');
        return;
      }

      this.logger.log(`Found ${strategies.length} strategies to evaluate`);

      // Process each strategy
      for (const strategy of strategies) {
        await this.evaluateStrategy(strategy);
      }
    } catch (error) {
      this.logger.error(`Error in checkStrategies: ${error.message}`, error.stack);
    }
  }

  /**
   * Evaluate a single strategy
   */
  private async evaluateStrategy(strategy: DCAStrategy) {
    try {
      this.logger.log(`Evaluating strategy: ${strategy.id}`);

      // Get decision from engine
      const decision = await this.decisionService.shouldExecute(strategy);

      // Serialize decision for JSON storage (convert BigInt to string)
      const serializedDecision = JSON.parse(JSON.stringify(decision, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      // Store execution record
      const execution = await this.prisma.execution.create({
        data: {
          strategyId: strategy.id,
          decision: serializedDecision, // JSON field
          recommendedAmount: decision.recommendedAmount.toString(),
          status: decision.shouldExecute ? 'pending' : 'skipped',
          price: decision.indicators.price,
          volatility: decision.indicators.volatility,
          liquidityScore: decision.indicators.liquidity,
          trend: decision.indicators.trend,
        },
      });

      // Update next check time
      await this.strategiesService.updateNextCheckTime(strategy.id, strategy.frequency);

      // If should execute, execute the swap via ExecutionService
      if (decision.shouldExecute) {
        this.logger.log(`Strategy ${strategy.id} should execute - calling ExecutionService`);

        // Emit event for WebSocket notification (for monitoring)
        this.eventEmitter.emit('execution.ready', {
          executionId: execution.id,
          strategy: {
            id: strategy.id,
            pairId: strategy.pairId,
            frequency: strategy.frequency,
            router: strategy.router,
            userId: strategy.userId,
          },
          decision,
          timestamp: new Date(),
        });

        // Execute the swap
        const result = await this.executionService.executeSwap(execution.id);

        if (result.success) {
          this.logger.log(`✅ Trade executed successfully: ${result.txHash}`);

          // Emit success event
          this.eventEmitter.emit('execution.completed', {
            executionId: execution.id,
            txHash: result.txHash,
            timestamp: new Date(),
          });
        } else {
          this.logger.error(`❌ Trade execution failed: ${result.error}`);

          // Emit failure event
          this.eventEmitter.emit('execution.failed', {
            executionId: execution.id,
            error: result.error,
            timestamp: new Date(),
          });
        }
      } else {
        this.logger.log(`Strategy ${strategy.id} skipped: ${decision.reason}`);
      }
    } catch (error) {
      this.logger.error(`Error evaluating strategy ${strategy.id}: ${error.message}`, error.stack);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerStrategyCheck(strategyId: string) {
    this.logger.log(`Manual trigger for strategy: ${strategyId}`);

    const strategy = await this.strategiesService.findOne(strategyId);
    await this.evaluateStrategy(strategy);
  }
}
