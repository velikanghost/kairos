-- AlterTable
ALTER TABLE "Execution" ADD COLUMN "usdcAmountIn" TEXT,
ADD COLUMN "wethAmountOut" TEXT,
ADD COLUMN "executionPrice" DOUBLE PRECISION;
