/**
 * Utility functions for formatting blockchain/smart contract errors into user-friendly messages
 */

/**
 * Parse hex-encoded error message from contract revert
 */
function parseHexError(hexString: string): string | null {
  try {
    // Remove 0x prefix if present
    const hex = hexString.replace('0x', '');

    // Check if it's an Error(string) revert (0x08c379a0 signature)
    if (hex.startsWith('08c379a0')) {
      // Skip function signature (4 bytes = 8 chars) and offset (32 bytes = 64 chars)
      const dataStart = 8 + 64;
      const lengthHex = hex.substring(dataStart, dataStart + 64);
      const length = parseInt(lengthHex, 16) * 2; // Convert to hex chars
      const messageHex = hex.substring(dataStart + 64, dataStart + 64 + length);

      // Convert hex to string
      const buffer = Buffer.from(messageHex, 'hex');
      return buffer.toString('utf8');
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Format error message into user-friendly text
 */
export function formatErrorMessage(error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Check for hex-encoded error in the message
  const hexMatch = errorMessage.match(/0x[0-9a-fA-F]{8,}/);
  if (hexMatch) {
    const parsedError = parseHexError(hexMatch[0]);
    if (parsedError) {
      // Map known contract errors to user-friendly messages
      return mapContractError(parsedError);
    }
  }

  // Check for common error patterns in plain text
  if (errorMessage.includes('ERC20PeriodTransferEnforcer:transfer-amount-exceeded')) {
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
    return 'Transaction was cancelled by user.';
  }

  if (errorMessage.includes('nonce too low')) {
    return 'Transaction nonce error. Please try again.';
  }

  if (errorMessage.includes('permission') && errorMessage.includes('expired')) {
    return 'Permission has expired. Please grant a new permission.';
  }

  // If no specific pattern matched, return a generic friendly message
  if (errorMessage.length > 100) {
    return 'Transaction failed. Please try again or contact support.';
  }

  return errorMessage;
}

/**
 * Map specific contract error messages to user-friendly descriptions
 */
function mapContractError(contractError: string): string {
  const errorMap: Record<string, string> = {
    'ERC20PeriodTransferEnforcer:transfer-amount-exceeded':
      'Daily spending limit reached. Please grant a new permission to continue trading.',
    'ERC20PeriodTransferEnforcer:invalid-execution-length':
      'Invalid transaction format. Please try again.',
    'DelegationManager:invalid-delegation':
      'Permission is invalid or has been revoked.',
    'DelegationManager:delegation-expired':
      'Permission has expired. Please grant a new permission.',
    'Unauthorized':
      'You are not authorized to perform this action.',
    'Insufficient allowance':
      'Token allowance is insufficient. Please approve more tokens.',
    'Transfer amount exceeds balance':
      'Insufficient token balance in your wallet.',
  };

  // Check for exact match
  if (errorMap[contractError]) {
    return errorMap[contractError];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (contractError.includes(key)) {
      return value;
    }
  }

  // Return original error if no mapping found, but make it more readable
  return contractError.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/:/g, ': ');
}
