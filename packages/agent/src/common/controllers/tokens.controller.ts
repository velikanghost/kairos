import { Controller, Get, Param, Logger } from '@nestjs/common';
import { TokenListService } from '../services/token-list.service';

@Controller('tokens')
export class TokensController {
  private readonly logger = new Logger(TokensController.name);

  constructor(private readonly tokenListService: TokenListService) {}

  @Get()
  async getAllTokens() {
    this.logger.log('Fetching all tokens');
    return await this.tokenListService.getAllTokens();
  }

  @Get(':addressOrSymbol')
  async getToken(@Param('addressOrSymbol') addressOrSymbol: string) {
    this.logger.log(`Fetching token: ${addressOrSymbol}`);
    const token = await this.tokenListService.getToken(addressOrSymbol);

    if (!token) {
      return { error: 'Token not found' };
    }

    return token;
  }

  @Get('pair/:pairId')
  async getPair(@Param('pairId') pairId: string) {
    this.logger.log(`Parsing pair: ${pairId}`);
    const pair = await this.tokenListService.parsePair(pairId);

    if (!pair) {
      return { error: 'Pair not found' };
    }

    return pair;
  }
}
