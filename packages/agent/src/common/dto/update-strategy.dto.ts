import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class UpdateStrategyDto {
  @IsString()
  @IsOptional()
  frequency?: '5min' | 'hourly' | 'daily' | 'weekly';

  @IsString()
  @IsOptional()
  baseAmount?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  slippage?: number;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
