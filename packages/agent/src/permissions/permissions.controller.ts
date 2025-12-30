import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { StorePermissionDto, PermissionResponseDto } from './dto/permission.dto';

@Controller('permissions')
export class PermissionsController {
  private readonly logger = new Logger(PermissionsController.name);

  constructor(private permissionsService: PermissionsService) {}

  /**
   * Store a new permission grant
   * POST /api/permissions
   */
  @Post()
  async storePermission(
    @Body() dto: StorePermissionDto,
  ): Promise<PermissionResponseDto> {
    this.logger.log(`[RAW REQUEST] Received permission storage request`);
    this.logger.log(`[REQUEST BODY] ${JSON.stringify(dto, null, 2)}`);
    this.logger.log(`Storing permission for user: ${dto.userId}`);
    return this.permissionsService.storePermission(dto);
  }

  /**
   * Get all active permissions for a user
   * GET /api/permissions/user/:userId
   */
  @Get('user/:userId')
  async getUserPermissions(
    @Param('userId') userId: string,
  ): Promise<PermissionResponseDto[]> {
    this.logger.log(`Getting permissions for user: ${userId}`);
    return this.permissionsService.getUserPermissions(userId);
  }

  /**
   * Get active permissions for a session account
   * GET /api/permissions/session/:address
   */
  @Get('session/:address')
  async getSessionAccountPermissions(
    @Param('address') address: string,
  ): Promise<PermissionResponseDto[]> {
    this.logger.log(`Getting permissions for session account: ${address}`);
    return this.permissionsService.getSessionAccountPermissions(address);
  }

  /**
   * Revoke a permission
   * POST /api/permissions/:id/revoke
   */
  @Post(':id/revoke')
  async revokePermission(
    @Param('id') id: string,
  ): Promise<PermissionResponseDto> {
    this.logger.log(`Revoking permission: ${id}`);
    return this.permissionsService.revokePermission(id);
  }

  /**
   * Check if a permission is valid
   * GET /api/permissions/:context/valid
   */
  @Get(':context/valid')
  async isPermissionValid(@Param('context') context: string): Promise<{ valid: boolean }> {
    const valid = await this.permissionsService.isPermissionValid(context);
    return { valid };
  }
}
