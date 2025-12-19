/**
 * Convert sqrtPriceX96 to actual price
 * Price = (sqrtPriceX96 / 2^96) ^ 2
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const Q96 = 2n ** 96n;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice ** 2;
}

/**
 * Convert price to sqrtPriceX96
 * sqrtPriceX96 = sqrt(price) * 2^96
 */
export function priceToSqrtPriceX96(price: number): bigint {
  const Q96 = 2n ** 96n;
  const sqrtPrice = Math.sqrt(price);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

/**
 * Format wei to human readable (for USDC with 6 decimals)
 */
export function formatUSDC(amountWei: bigint): number {
  return Number(amountWei) / 1e6;
}

/**
 * Format wei to human readable (for ETH with 18 decimals)
 */
export function formatETH(amountWei: bigint): number {
  return Number(amountWei) / 1e18;
}

/**
 * Parse human readable amount to wei (USDC 6 decimals)
 */
export function parseUSDC(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e6));
}

/**
 * Parse human readable amount to wei (ETH 18 decimals)
 */
export function parseETH(amount: number): bigint {
  return BigInt(Math.floor(amount * 1e18));
}
