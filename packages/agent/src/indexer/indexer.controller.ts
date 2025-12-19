import { Controller, Get, Query, Logger } from '@nestjs/common';
import { IndexerService } from './indexer.service';

// Helper to convert BigInt to string for JSON serialization
function bigIntReplacer(_key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value;
}

@Controller('indexer')
export class IndexerController {
  private readonly logger = new Logger(IndexerController.name);

  constructor(
    private readonly indexerService: IndexerService,
  ) {}

  @Get('price')
  async getCurrentPrice(@Query('pairId') pairId: string = 'WETH-USDC') {
    this.logger.log(`Fetching current price for ${pairId}`);
    const result = await this.indexerService.getCurrentPrice(pairId);
    return JSON.parse(JSON.stringify(result, bigIntReplacer));
  }

  @Get('swaps')
  async getRecentSwaps(@Query('limit') limit?: number) {
    const swapLimit = limit ? parseInt(limit.toString()) : 10;
    this.logger.log(`Fetching ${swapLimit} recent swaps`);
    const result = await this.indexerService.getRecentSwaps(swapLimit);
    return JSON.parse(JSON.stringify(result, bigIntReplacer));
  }

  @Get('volume')
  async get24hVolume() {
    this.logger.log('Fetching 24h volume');
    return await this.indexerService.get24hVolume();
  }

  @Get('liquidity')
  async getPoolLiquidity() {
    this.logger.log('Fetching pool liquidity');
    const result = await this.indexerService.getPoolLiquidity();
    return JSON.parse(JSON.stringify(result, bigIntReplacer));
  }

  @Get('historical')
  async getHistoricalPrices(@Query('hours') hours?: number) {
    const timeframe = hours ? parseInt(hours.toString()) : 24;
    this.logger.log(`Fetching ${timeframe}h historical prices`);
    return await this.indexerService.getHistoricalPrices(timeframe);
  }
}
