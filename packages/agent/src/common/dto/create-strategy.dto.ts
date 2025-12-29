import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateStrategyDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  pairId: string;

  @IsString()
  @IsNotEmpty()
  frequency: '5min' | 'hourly' | 'daily' | 'weekly';

  @IsString()
  @IsNotEmpty()
  baseAmount: string; // Amount in wei as string

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  slippage?: number;

  @IsString()
  @IsOptional()
  permissionHash?: string;

  @IsString()
  @IsOptional()
  permissionExpiry?: string; // ISO date string

  @IsBoolean()
  @IsOptional()
  enableSmartSizing?: boolean;

  @IsBoolean()
  @IsOptional()
  enableVolatilityAdjustment?: boolean;

  @IsBoolean()
  @IsOptional()
  enableLiquidityCheck?: boolean;

  @IsString()
  @IsOptional()
  router?: 'uniswap_v4';
}
