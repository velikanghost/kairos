import { IsString, IsNotEmpty, IsNumber, IsObject, IsDateString } from 'class-validator';

export class StorePermissionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  sessionAccountAddress: string;

  @IsString()
  @IsNotEmpty()
  permissionContext: string;

  @IsString()
  @IsNotEmpty()
  delegationManager: string;

  @IsString()
  @IsNotEmpty()
  permissionType: string;

  @IsNumber()
  chainId: number;

  @IsObject()
  permissionData: any; // Full permission object from MetaMask

  @IsDateString()
  expiresAt: string;
}

export class PermissionResponseDto {
  id: string;
  userId: string;
  sessionAccountAddress: string;
  permissionContext: string;
  delegationManager: string;
  permissionType: string;
  chainId: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
