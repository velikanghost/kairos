import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticateDto } from './dto/authenticate.dto';
import { StorePermissionDto } from './dto/store-permission.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate user with Web3Auth
   * Frontend sends idToken after user logs in
   */
  @Post('authenticate')
  async authenticate(@Body() dto: AuthenticateDto) {
    try {
      this.logger.log('Authentication request received');

      const result = await this.authService.authenticateUser(dto);

      return {
        success: true,
        data: {
          userId: result.user.id,
          email: result.user.email,
          name: result.user.name,
          eoaAddress: result.eoaAddress,
          smartAccountAddress: result.user.smartAccountAddress,
        },
      };
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Authentication failed',
          error: error.message,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Create smart account for authenticated user
   */
  @Post('smart-account/:userId')
  async createSmartAccount(
    @Param('userId') userId: string,
    @Body() body: { authConnectionId: string; idToken: string },
  ) {
    try {
      this.logger.log(`Creating smart account for user: ${userId}`);

      const result = await this.authService.createSmartAccount({
        userId,
        authConnectionId: body.authConnectionId,
        idToken: body.idToken,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Smart account creation failed:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create smart account',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Store permission grant from user
   */
  @Post('permissions')
  async storePermission(@Body() dto: StorePermissionDto) {
    try {
      this.logger.log(`Storing permission for user: ${dto.userId}`);

      const permission = await this.authService.storePermission({
        ...dto,
        expiresAt: new Date(dto.expiresAt),
        delegationManager: dto.delegationManager as `0x${string}`,
      });

      return {
        success: true,
        data: permission,
      };
    } catch (error) {
      this.logger.error('Failed to store permission:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to store permission',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user's active permissions
   */
  @Get('permissions/:userId')
  async getUserPermissions(@Param('userId') userId: string) {
    try {
      const permissions = await this.authService.getUserPermissions(userId);

      return {
        success: true,
        data: permissions,
      };
    } catch (error) {
      this.logger.error('Failed to get permissions:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get permissions',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke a permission
   */
  @Post('permissions/:permissionId/revoke')
  async revokePermission(@Param('permissionId') permissionId: string) {
    try {
      this.logger.log(`Revoking permission: ${permissionId}`);

      const permission = await this.authService.revokePermission(permissionId);

      return {
        success: true,
        data: permission,
      };
    } catch (error) {
      this.logger.error('Failed to revoke permission:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to revoke permission',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user info by ID
   */
  @Get('user/:userId')
  async getUserById(@Param('userId') userId: string) {
    try {
      const user = await this.authService.getUserById(userId);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          eoaAddress: user.eoaAddress,
          smartAccountAddress: user.smartAccountAddress,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user:', error.message);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get user',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
