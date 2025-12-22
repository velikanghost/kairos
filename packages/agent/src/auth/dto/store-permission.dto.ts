import { IsString, IsDateString, IsOptional, IsObject } from 'class-validator';

export class StorePermissionDto {
  @IsString()
  userId: string;

  @IsString()
  permissionContext: string;

  @IsString()
  delegationManager: string;

  @IsDateString()
  expiresAt: string;

  @IsString()
  permissionType: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}
