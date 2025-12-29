/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const relevantValues = values.slice(-period);
  const sum = relevantValues.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate volatility using coefficient of variation
 * CV = (standard deviation / mean) * 100
 */
export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const mean = prices.reduce((acc, val) => acc + val, 0) / prices.length;
  if (mean === 0) return 0;

  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // Log price statistics for debugging
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const cv = (stdDev / mean) * 100;

  console.log(`Volatility calculation: ${prices.length} prices, min=${min.toFixed(2)}, max=${max.toFixed(2)}, mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(2)}, CV=${cv.toFixed(2)}%`);

  return cv; // Return as percentage
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Detect volume spike
 * Returns true if current volume is significantly higher than average
 */
export function isVolumeSpike(currentVolume: number, avgVolume: number, threshold = 2.0): boolean {
  if (avgVolume === 0) return false;
  return currentVolume > avgVolume * threshold;
}

/**
 * Normalize value to 0-1 range
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate percentage change
 */
export function percentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
