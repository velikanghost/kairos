-- CreateTable
CREATE TABLE "DCAStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "baseAmount" TEXT NOT NULL,
    "slippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "permissionHash" TEXT,
    "permissionExpiry" TIMESTAMP(3),
    "enableSmartSizing" BOOLEAN NOT NULL DEFAULT true,
    "enableVolatilityAdjustment" BOOLEAN NOT NULL DEFAULT true,
    "enableLiquidityCheck" BOOLEAN NOT NULL DEFAULT true,
    "router" TEXT NOT NULL DEFAULT 'kuru_dex',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextCheckTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DCAStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "decision" JSONB NOT NULL,
    "recommendedAmount" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "errorMessage" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,
    "liquidityScore" DOUBLE PRECISION NOT NULL,
    "trend" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sqrtPriceX96" TEXT NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "volumeChange" DOUBLE PRECISION NOT NULL,
    "totalLiquidity" TEXT NOT NULL,
    "liquidityScore" DOUBLE PRECISION NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,
    "ma7" DOUBLE PRECISION,
    "ma30" DOUBLE PRECISION,
    "trend" TEXT,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DCAStrategy_userId_idx" ON "DCAStrategy"("userId");

-- CreateIndex
CREATE INDEX "DCAStrategy_nextCheckTime_idx" ON "DCAStrategy"("nextCheckTime");

-- CreateIndex
CREATE INDEX "DCAStrategy_isActive_idx" ON "DCAStrategy"("isActive");

-- CreateIndex
CREATE INDEX "Execution_strategyId_idx" ON "Execution"("strategyId");

-- CreateIndex
CREATE INDEX "Execution_status_idx" ON "Execution"("status");

-- CreateIndex
CREATE INDEX "Execution_createdAt_idx" ON "Execution"("createdAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_pairId_idx" ON "MarketSnapshot"("pairId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_timestamp_idx" ON "MarketSnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSnapshot_pairId_blockNumber_key" ON "MarketSnapshot"("pairId", "blockNumber");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "DCAStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
