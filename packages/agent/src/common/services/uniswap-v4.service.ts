import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  encodeFunctionData,
  type Address,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';

/**
 * Service for interacting with Uniswap V4 via Universal Router
 * Based on Uniswap V4 SDK documentation
 */
@Injectable()
export class UniswapV4Service {
  private readonly logger = new Logger(UniswapV4Service.name);

  // Common token addresses on Sepolia
  private readonly ETH = '0x0000000000000000000000000000000000000000'; // Native ETH (address zero)
  private readonly TOKEN1 = '0xC4cC6efb54a84abbCAC1AAD86e1462c4358De6Be'; // Token from Pool 14 (existing pool with liquidity)
  private readonly WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
  private readonly USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  private readonly DAI = '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357';

  private readonly universalRouterAddress: Address;
  private readonly poolManagerAddress: Address;

  constructor(private config: ConfigService) {
    this.universalRouterAddress = this.config.get('blockchain.contracts.universalRouter') as Address;
    this.poolManagerAddress = this.config.get('blockchain.contracts.poolManager') as Address;
  }

  /**
   * Parse pair ID to get token addresses
   * Examples: "ETH/USDC", "WETH/USDC", "WETH/DAI"
   */
  private parsePairId(pairId: string): { token0: Address; token1: Address } {
    const [base, quote] = pairId.split('/');

    const getTokenAddress = (symbol: string): Address => {
      switch (symbol.toUpperCase()) {
        case 'ETH':
          return this.ETH; // Use native ETH (Pool 14 uses native ETH)
        case 'WETH':
          return this.WETH;
        case 'USDC':
          return this.TOKEN1; // Map USDC to TOKEN1 for testing with existing pool
        case 'DAI':
          return this.DAI;
        default:
          throw new Error(`Unknown token: ${symbol}`);
      }
    };

    const baseAddr = getTokenAddress(base);
    const quoteAddr = getTokenAddress(quote);

    // Ensure token0 < token1 (Uniswap V4 requirement)
    const [token0, token1] = baseAddr < quoteAddr
      ? [baseAddr, quoteAddr]
      : [quoteAddr, baseAddr];

    return { token0, token1 };
  }

  /**
   * Build swap calldata for Uniswap V4 via Universal Router
   * This uses the V4Planner pattern as documented in Uniswap V4 SDK
   */
  async buildSwapCalldata(
    pairId: string,
    amountIn: bigint,
    slippageTolerance: number,
  ): Promise<{ to: Address; data: `0x${string}`; value: bigint }> {
    this.logger.log(`Building swap for ${pairId}, amount: ${amountIn}, slippage: ${slippageTolerance}%`);

    const { token0, token1 } = this.parsePairId(pairId);

    // Determine swap direction based on actual pool token order
    // Pool 14: currency0=ETH (0x000...), currency1=TOKEN1 (0xC4c...)
    // For ETH/USDC pair (user input which maps to ETH/TOKEN1), we swap ETH (currency0) for TOKEN1 (currency1)
    // So we need zeroForOne = true (swapping from token0 to token1)
    const zeroForOne = true; // Swapping ETH (currency0) → TOKEN1 (currency1)

    // PoolKey structure for Uniswap V4
    // Using Pool 14: ETH/TOKEN1 at 0.3% fee tier (existing pool with liquidity)
    const poolKey = {
      currency0: token0,
      currency1: token1,
      fee: 3000, // 0.3% fee tier
      tickSpacing: 60, // Tick spacing for 0.3% fee tier
      hooks: '0x0000000000000000000000000000000000000000' as Address, // No hooks
    };

    // Calculate minimum amount out based on slippage
    // For now, accept any amount (will be improved with proper quotes)
    const amountOutMinimum = '0';

    // Build swap configuration for V4Planner
    const swapConfig = {
      poolKey,
      zeroForOne,
      amountIn: amountIn.toString(),
      amountOutMinimum,
      hookData: '0x00' as `0x${string}`,
    };

    this.logger.log(`Swap config: ${JSON.stringify(swapConfig)}`);

    // Create V4Planner to batch operations using proper SDK
    // The V4Planner batches these actions:
    // 1. SWAP_EXACT_IN_SINGLE - execute the swap
    // 2. SETTLE_ALL - pay input tokens
    // 3. TAKE_ALL - receive output tokens

    const v4Planner = new V4Planner();

    // Add SWAP_EXACT_IN_SINGLE action - pass the entire config object per SDK docs
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);

    // Add SETTLE_ALL action (pay input tokens)
    v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, swapConfig.amountIn]);

    // Add TAKE_ALL action (receive output tokens)
    v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, amountOutMinimum]);

    // Create RoutePlanner and add V4_SWAP command with proper two-parameter format
    const routePlanner = new RoutePlanner();
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

    // Set deadline (1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Encode the Universal Router execute call
    const data = encodeFunctionData({
      abi: [
        {
          inputs: [
            { internalType: 'bytes', name: 'commands', type: 'bytes' },
            { internalType: 'bytes[]', name: 'inputs', type: 'bytes[]' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          ],
          name: 'execute',
          outputs: [],
          stateMutability: 'payable',
          type: 'function',
        },
      ],
      functionName: 'execute',
      args: [routePlanner.commands as `0x${string}`, routePlanner.inputs as `0x${string}`[], BigInt(deadline)],
    });

    // For WETH swaps, we need to send value to wrap ETH
    // Universal Router can handle ETH→WETH wrapping automatically when value is sent
    const isEthSwap = pairId.startsWith('ETH/') || pairId.startsWith('WETH/');
    const value = isEthSwap ? amountIn : BigInt(0);

    this.logger.log(`Built Universal Router swap: to=${this.universalRouterAddress}, value=${value}`);

    return {
      to: this.universalRouterAddress, // Use Universal Router, not PoolManager
      data,
      value,
    };
  }

  /**
   * Calculate minimum amount out based on slippage
   */
  calculateMinAmountOut(
    amountOut: bigint,
    slippageTolerance: number,
  ): bigint {
    const slippageBps = BigInt(Math.floor(slippageTolerance * 100)); // Convert % to basis points
    const minAmount = (amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000);
    return minAmount;
  }

  /**
   * Get token addresses for a pair
   */
  getTokenAddresses(pairId: string): { token0: Address; token1: Address } {
    return this.parsePairId(pairId);
  }
}
