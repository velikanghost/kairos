import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { SessionAccountService } from './session-account.service';
import {
  GetOrCreateSessionAccountDto,
  SessionAccountResponseDto,
} from './dto/session-account.dto';

@Controller('session-accounts')
export class SessionAccountController {
  private readonly logger = new Logger(SessionAccountController.name);

  constructor(private sessionAccountService: SessionAccountService) {}

  /**
   * Get or create a session account for a user
   * POST /api/session-accounts
   */
  @Post()
  async getOrCreateSessionAccount(
    @Body() dto: GetOrCreateSessionAccountDto,
  ): Promise<SessionAccountResponseDto> {
    this.logger.log(`Getting or creating session account for user: ${dto.userId}`);

    const result = await this.sessionAccountService.getOrCreateSessionAccount(
      dto.userId,
    );

    return {
      address: result.address,
      implementation: result.implementation,
    };
  }

  /**
   * Get all session accounts for a user
   * GET /api/session-accounts/:userId
   */
  @Get(':userId')
  async getUserSessionAccounts(@Param('userId') userId: string) {
    this.logger.log(`Getting session accounts for user: ${userId}`);
    return this.sessionAccountService.getUserSessionAccounts(userId);
  }

  /**
   * Deactivate a session account
   * POST /api/session-accounts/:address/deactivate
   */
  @Post(':address/deactivate')
  async deactivateSessionAccount(@Param('address') address: string) {
    this.logger.log(`Deactivating session account: ${address}`);
    await this.sessionAccountService.deactivateSessionAccount(address);
    return { success: true };
  }
}
