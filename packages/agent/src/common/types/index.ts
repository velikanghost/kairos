export interface ExecutionDecision {
  shouldExecute: boolean;
  recommendedAmount: bigint;
  reason: string;
  confidence: number; // 0-1
  indicators: {
    price: number;
    volatility: number;
    liquidity: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    volume24h?: number;
  };
}

export interface PriceData {
  price: number;
  sqrtPriceX96: bigint;
  blockNumber: number;
  timestamp: number;
}

export interface LiquidityData {
  totalLiquidity: bigint;
  liquidityScore: number; // 0-1
  tickLower?: number;
  tickUpper?: number;
}

export interface VolumeData {
  volume24h: number;
  volumeChange: number; // percentage
  swapCount: number;
}

export interface Indicators {
  volatility: number;
  ma7?: number;
  ma30?: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  priceChange24h: number;
  volumeRatio: number; // current volume / avg volume
  liquidityScore: number;
}

export interface SwapEvent {
  id: string;
  event_id: string;
  sender: string;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  fee: number;
  blockNumber: number;
  timestamp: number;
}

export type FrequencyType = 'hourly' | 'daily' | 'weekly';
export type RouterType = 'kuru_dex' | 'uniswap_v4';
export type ExecutionStatus = 'pending' | 'sent_to_frontend' | 'executed' | 'skipped' | 'failed';
export type TrendType = 'bullish' | 'bearish' | 'neutral';

export interface ExecutionNotification {
  executionId: string;
  strategy: {
    id: string;
    userId: string;
    pairId: string;
    frequency: string;
    router: string;
  };
  decision: ExecutionDecision;
  timestamp: Date;
}
