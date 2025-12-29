import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DCAStrategy, Execution } from '@prisma/client';
import { CreateStrategyDto } from '../common/dto/create-strategy.dto';
import { UpdateStrategyDto } from '../common/dto/update-strategy.dto';

@Injectable()
export class StrategiesService {
  private readonly logger = new Logger(StrategiesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new DCA strategy
   */
  async create(dto: CreateStrategyDto): Promise<DCAStrategy> {
    this.logger.log(`Creating strategy for user: ${dto.userId}`);

    // Ensure user exists and get their ID
    // dto.userId is actually the wallet address from the frontend
    const user = await this.prisma.user.upsert({
      where: { walletAddress: dto.userId },
      create: { walletAddress: dto.userId },
      update: {},
    });

    const nextCheckTime = this.calculateNextCheckTime(dto.frequency);

    const strategy = await this.prisma.dCAStrategy.create({
      data: {
        userId: user.id, // Use the actual User ID (UUID)
        pairId: dto.pairId,
        frequency: dto.frequency,
        baseAmount: dto.baseAmount,
        slippage: dto.slippage ?? 0.5,
        permissionHash: dto.permissionHash,
        permissionExpiry: dto.permissionExpiry ? new Date(dto.permissionExpiry) : null,
        enableSmartSizing: dto.enableSmartSizing ?? true,
        enableVolatilityAdjustment: dto.enableVolatilityAdjustment ?? true,
        enableLiquidityCheck: dto.enableLiquidityCheck ?? true,
        router: dto.router ?? 'uniswap_v4',
        nextCheckTime,
      },
    });

    this.logger.log(`Strategy created: ${strategy.id}`);
    return strategy;
  }

  /**
   * Get all strategies for a user
   * @param walletAddress - The user's wallet address
   */
  async findByUser(walletAddress: string): Promise<DCAStrategy[]> {
    // Find user by wallet address first
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return []; // No user = no strategies
    }

    return this.prisma.dCAStrategy.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single strategy by ID
   */
  async findOne(id: string): Promise<DCAStrategy> {
    const strategy = await this.prisma.dCAStrategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException(`Strategy ${id} not found`);
    }

    return strategy;
  }

  /**
   * Update strategy
   */
  async update(id: string, dto: UpdateStrategyDto): Promise<DCAStrategy> {
    this.logger.log(`Updating strategy: ${id}`);

    const data: any = { ...dto };

    // Recalculate next check time if frequency changed
    if (dto.frequency) {
      data.nextCheckTime = this.calculateNextCheckTime(dto.frequency);
    }

    const strategy = await this.prisma.dCAStrategy.update({
      where: { id },
      data,
    });

    this.logger.log(`Strategy updated: ${id}`);
    return strategy;
  }

  /**
   * Delete strategy
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting strategy: ${id}`);

    await this.prisma.dCAStrategy.delete({
      where: { id },
    });

    this.logger.log(`Strategy deleted: ${id}`);
  }

  /**
   * Activate strategy
   */
  async activate(id: string): Promise<DCAStrategy> {
    return this.prisma.dCAStrategy.update({
      where: { id },
      data: {
        isActive: true,
        nextCheckTime: this.calculateNextCheckTime('daily'), // Default to daily
      },
    });
  }

  /**
   * Deactivate strategy
   */
  async deactivate(id: string): Promise<DCAStrategy> {
    return this.prisma.dCAStrategy.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get strategies due for execution check
   */
  async findDueStrategies(): Promise<DCAStrategy[]> {
    return this.prisma.dCAStrategy.findMany({
      where: {
        isActive: true,
        nextCheckTime: {
          lte: new Date(),
        },
      },
    });
  }

  /**
   * Update next check time for a strategy
   */
  async updateNextCheckTime(id: string, frequency: string): Promise<void> {
    const nextCheckTime = this.calculateNextCheckTime(frequency);

    await this.prisma.dCAStrategy.update({
      where: { id },
      data: { nextCheckTime },
    });
  }

  /**
   * Get execution history for a strategy
   */
  async getExecutions(strategyId: string, limit: number = 50): Promise<Execution[]> {
    return this.prisma.execution.findMany({
      where: { strategyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Calculate next check time based on frequency
   */
  private calculateNextCheckTime(frequency: string): Date {
    const now = new Date();

    switch (frequency) {
      case '5min':
        return new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 1 day
    }
  }
}
