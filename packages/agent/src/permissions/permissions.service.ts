import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorePermissionDto } from './dto/permission.dto';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Store a new permission grant from the user
   * userId is actually the wallet address, we need to look up the real user ID
   */
  async storePermission(dto: StorePermissionDto) {
    try {
      this.logger.log(
        `Storing permission for user ${dto.userId}, session account ${dto.sessionAccountAddress}`,
      );

      // Look up user by wallet address (dto.userId is actually wallet address)
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: dto.userId.toLowerCase() },
      });

      if (!user) {
        throw new Error(`User with wallet address ${dto.userId} not found`);
      }

      // Look up session account by address to get its ID
      const sessionAccount = await this.prisma.sessionAccount.findUnique({
        where: { address: dto.sessionAccountAddress.toLowerCase() },
      });

      if (!sessionAccount) {
        throw new Error(
          `Session account with address ${dto.sessionAccountAddress} not found`,
        );
      }

      const permission = await this.prisma.permission.create({
        data: {
          userId: user.id, // Use the actual user ID
          sessionAccountId: sessionAccount.id, // Use the session account's UUID
          sessionAccountAddress: dto.sessionAccountAddress,
          permissionContext: dto.permissionContext,
          delegationManager: dto.delegationManager,
          permissionType: dto.permissionType,
          chainId: dto.chainId,
          permissionData: dto.permissionData,
          expiresAt: new Date(dto.expiresAt),
        },
      });

      this.logger.log(`Permission stored: ${permission.id}`);

      return permission;
    } catch (error) {
      this.logger.error('Failed to store permission:', error.message);
      throw error;
    }
  }

  /**
   * Get all active permissions for a user
   * userId is actually the wallet address
   */
  async getUserPermissions(walletAddress: string) {
    // Look up user by wallet address
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      return []; // No user, no permissions
    }

    return this.prisma.permission.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gte: new Date(),
        },
        revokedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get active permission by context
   */
  async getPermissionByContext(permissionContext: string) {
    return this.prisma.permission.findFirst({
      where: {
        permissionContext,
        expiresAt: {
          gte: new Date(),
        },
        revokedAt: null,
      },
    });
  }

  /**
   * Get active permissions for a session account
   */
  async getSessionAccountPermissions(sessionAccountAddress: string) {
    return this.prisma.permission.findMany({
      where: {
        sessionAccountAddress,
        expiresAt: {
          gte: new Date(),
        },
        revokedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Revoke a permission
   */
  async revokePermission(permissionId: string) {
    try {
      this.logger.log(`Revoking permission: ${permissionId}`);

      const permission = await this.prisma.permission.update({
        where: { id: permissionId },
        data: { revokedAt: new Date() },
      });

      this.logger.log(`Permission revoked: ${permissionId}`);

      return permission;
    } catch (error) {
      this.logger.error('Failed to revoke permission:', error.message);
      throw error;
    }
  }

  /**
   * Check if a permission is still valid
   */
  async isPermissionValid(permissionContext: string): Promise<boolean> {
    const permission = await this.getPermissionByContext(permissionContext);
    return !!permission;
  }
}
