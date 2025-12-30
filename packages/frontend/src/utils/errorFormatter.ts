/**
 * Client-side utility for formatting errors into user-friendly messages
 */

/**
 * Format error message into user-friendly text
 */
export function formatErrorMessage(error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Already user-friendly (short and simple)
  if (errorMessage.length < 100 && !errorMessage.includes('0x') && !errorMessage.includes('execution reverted')) {
    return errorMessage;
  }

  // Check for common error patterns
  if (errorMessage.includes('ERC20PeriodTransferEnforcer:transfer-amount-exceeded') ||
      errorMessage.includes('transfer-amount-exceeded')) {
    return 'Daily spending limit reached. Please grant a new permission to continue trading.';
  }

  if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
    return 'Insufficient balance in your wallet. Please add more funds.';
  }

  if (errorMessage.includes('STF') || errorMessage.includes('SafeTransferFrom')) {
    return 'Token transfer failed. Please check your token balance and approvals.';
  }

  if (errorMessage.includes('AS') || errorMessage.includes('assertion')) {
    return 'Swap failed due to price slippage. Try increasing slippage tolerance.';
  }

  if (errorMessage.includes('out_of_gas') || errorMessage.includes('out of gas')) {
    return 'Transaction ran out of gas. Please try again.';
  }

  if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
    return 'Transaction was cancelled.';
  }

  if (errorMessage.includes('nonce too low')) {
    return 'Transaction nonce error. Please try again.';
  }

  if (errorMessage.includes('permission') && errorMessage.includes('expired')) {
    return 'Permission has expired. Please grant a new permission.';
  }

  if (errorMessage.includes('connector not found') || errorMessage.includes('wallet not connected')) {
    return 'Please connect your wallet first.';
  }

  if (errorMessage.includes('network') || errorMessage.includes('chain')) {
    return 'Network error. Please check your connection and try again.';
  }

  // If error is very long or contains hex/technical data, return generic message
  if (errorMessage.length > 150 || errorMessage.includes('0x')) {
    return 'Transaction failed. Please try again or contact support.';
  }

  return errorMessage;
}
