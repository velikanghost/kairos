import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import type { ExecutionNotification } from '../common/types';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;

    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id}, userId: ${userId}`);
    } else {
      this.logger.warn(`Client connected without userId: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Listen for execution ready events from scheduler
   */
  @OnEvent('execution.ready')
  handleExecutionReady(notification: ExecutionNotification) {
    this.logger.log(`Sending execution notification to user: ${notification.strategy.userId}`);

    this.server.to(`user:${notification.strategy.userId}`).emit('execution:ready', {
      executionId: notification.executionId,
      strategy: notification.strategy,
      decision: {
        shouldExecute: notification.decision.shouldExecute,
        recommendedAmount: notification.decision.recommendedAmount.toString(),
        reason: notification.decision.reason,
        confidence: notification.decision.confidence,
        indicators: notification.decision.indicators,
      },
      timestamp: notification.timestamp,
    });
  }

  /**
   * Client confirms execution completed
   */
  @SubscribeMessage('execution:completed')
  async handleExecutionCompleted(
    @MessageBody() data: { executionId: string; txHash: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Execution completed: ${data.executionId}, txHash: ${data.txHash}`);

    try {
      await this.prisma.execution.update({
        where: { id: data.executionId },
        data: {
          status: 'executed',
          txHash: data.txHash,
          executedAt: new Date(),
        },
      });

      return { success: true, message: 'Execution recorded' };
    } catch (error) {
      this.logger.error(`Error recording execution: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * Client reports execution failed
   */
  @SubscribeMessage('execution:failed')
  async handleExecutionFailed(
    @MessageBody() data: { executionId: string; error: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.warn(`Execution failed: ${data.executionId}, error: ${data.error}`);

    try {
      await this.prisma.execution.update({
        where: { id: data.executionId },
        data: {
          status: 'failed',
          errorMessage: data.error,
        },
      });

      return { success: true, message: 'Failure recorded' };
    } catch (error) {
      this.logger.error(`Error recording failure: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * Subscribe to market updates for a specific pair
   */
  @SubscribeMessage('market:subscribe')
  handleMarketSubscribe(
    @MessageBody() data: { pairId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`market:${data.pairId}`);
    this.logger.log(`Client ${client.id} subscribed to market: ${data.pairId}`);
    return { success: true };
  }

  /**
   * Unsubscribe from market updates
   */
  @SubscribeMessage('market:unsubscribe')
  handleMarketUnsubscribe(
    @MessageBody() data: { pairId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`market:${data.pairId}`);
    this.logger.log(`Client ${client.id} unsubscribed from market: ${data.pairId}`);
    return { success: true };
  }

  /**
   * Send market update to all subscribers
   */
  sendMarketUpdate(pairId: string, indicators: any) {
    this.server.to(`market:${pairId}`).emit('market:update', {
      pairId,
      indicators,
      timestamp: new Date(),
    });
  }
}
