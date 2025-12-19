import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { IndexerModule } from './indexer/indexer.module';
import { IndicatorsModule } from './indicators/indicators.module';
import { DecisionModule } from './decision/decision.module';

// Feature modules
import { StrategiesModule } from './strategies/strategies.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { NotificationsModule } from './notifications/notifications.module';

// Original app files
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
    StrategiesModule,
    SchedulerModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
