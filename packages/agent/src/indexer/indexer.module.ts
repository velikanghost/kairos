import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { IndexerController } from './indexer.controller';
import { PythOracleService } from '../common/services/pyth-oracle.service';

@Module({
  controllers: [IndexerController],
  providers: [IndexerService, PythOracleService],
  exports: [IndexerService],
})
export class IndexerModule {}
