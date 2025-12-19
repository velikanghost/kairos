import { Module } from '@nestjs/common';
import { DecisionService } from './decision.service';
import { IndicatorsModule } from '../indicators/indicators.module';
import { IndexerModule } from '../indexer/indexer.module';

@Module({
  imports: [IndicatorsModule, IndexerModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
