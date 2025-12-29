import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { IndexerModule } from './indexer/indexer.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { DecisionModule } from './decision/decision.module';

// Feature modules
import { SessionAccountModule } from './session-account/session-account.module';
import { PermissionsModule } from './permissions/permissions.module';
import { StrategiesModule } from './strategies/strategies.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExecutionModule } from './execution/execution.module';

// Original app files
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Token list service
import { TokenListService } from './common/services/token-list.service';
import { TokensController } from './common/controllers/tokens.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Core infrastructure
    PrismaModule,
    IndexerModule,
    IndicatorsModule,
    DecisionModule,

    // Features
    SessionAccountModule,
    PermissionsModule,
    StrategiesModule,
    ExecutionModule,
    SchedulerModule,
    NotificationsModule,
  ],
  controllers: [AppController, TokensController],
  providers: [AppService, TokenListService],
  exports: [TokenListService],
})
export class AppModule {}
