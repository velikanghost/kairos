import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SchedulerService } from './scheduler.service';
import { StrategiesModule } from '../strategies/strategies.module';
import { DecisionModule } from '../decision/decision.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    StrategiesModule,
    DecisionModule,
    ExecutionModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
