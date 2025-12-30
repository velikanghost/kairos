import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Address } from 'viem';

/**
 * Service for interacting with Uniswap V3 SwapRouter02
 * Based on our working simple-swap.ts test
 */
@Injectable()
export class UniswapV3Service {
  private readonly logger = new Logger(UniswapV3Service.name);

  // Uniswap V3 contract addresses on Sepolia
  private readonly SWAP_ROUTER_ADDRESS: Address = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'; // SwapRouter02

  // Common token addresses on Sepolia
  private readonly WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
  private readonly USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  private readonly DAI = '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357';

  constructor(private config: ConfigService) {}

  /**
   * Parse pair ID to get token addresses
   * Examples: "ETH/USDC", "WETH/USDC", "WETH/DAI"
   */
  private parsePairId(pairId: string): { tokenIn: Address; tokenOut: Address } {
    const [base, quote] = pairId.split('/');

    const getTokenAddress = (symbol: string): Address => {
      switch (symbol.toUpperCase()) {
        case 'ETH':
        case 'WETH':
          return this.WETH; // V3 uses WETH, not native ETH
        case 'USDC':
          return this.USDC;
        case 'DAI':
          return this.DAI;
        default:
          throw new Error(`Unknown token: ${symbol}`);
      }
    };

    const tokenIn = getTokenAddress(base);
    const tokenOut = getTokenAddress(quote);

    return { tokenIn, tokenOut };
  }

  /**
   * Build swap calldata for Uniswap V3 SwapRouter02
   * Returns transaction parameters for exactInputSingle
   */
  async buildSwapCalldata(
    pairId: string,
    amountIn: bigint,
    slippageTolerance: number,
  ): Promise<{ to: Address; data: `0x${string}`; value: bigint }> {
    this.logger.log(
      `Building V3 swap for ${pairId}, amount: ${amountIn}, slippage: ${slippageTolerance}%`,
    );

    const { tokenIn, tokenOut } = this.parsePairId(pairId);

    // Get recipient from session account (will be set by execution service)
    // For now, we'll encode with zero address and let the execution service handle it
    const recipient = '0x0000000000000000000000000000000000000000' as Address;

    // Calculate minimum amount out based on slippage
    // For simplicity, using 0 for now (accept any amount)
    // In production, you'd want to get a quote first
    const amountOutMinimum = BigInt(0);

    // SwapRouter02 exactInputSingle parameters
    // struct ExactInputSingleParams {
    //     address tokenIn;
    //     address tokenOut;
    //     uint24 fee;
    //     address recipient;
    //     uint256 amountIn;
    //     uint256 amountOutMinimum;
    //     uint160 sqrtPriceLimitX96;
    // }

    // Encode the function call
    // function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut)
    const functionSignature =
      'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))';

    // Manually encode the calldata
    // Function selector: first 4 bytes of keccak256(functionSignature)
    const { keccak256, toBytes, concat, encodeAbiParameters, parseAbiParameters } = await import('viem');

    const selector = keccak256(toBytes(functionSignature)).slice(0, 10) as `0x${string}`;

    // Encode the struct parameters
    const params = encodeAbiParameters(
      parseAbiParameters('address, address, uint24, address, uint256, uint256, uint160'),
      [
        tokenIn,
        tokenOut,
        3000, // 0.3% fee tier
        recipient, // Will be replaced by execution service
        amountIn,
        amountOutMinimum,
        BigInt(0), // sqrtPriceLimitX96 (0 = no limit)
      ],
    );

    // Combine selector and params
    const data = concat([selector, params]);

    this.logger.log(`Encoded swap calldata for V3 SwapRouter02`);
    this.logger.log(`  Token In: ${tokenIn}`);
    this.logger.log(`  Token Out: ${tokenOut}`);
    this.logger.log(`  Amount In: ${amountIn}`);
    this.logger.log(`  Fee: 3000 (0.3%)`);

    return {
      to: this.SWAP_ROUTER_ADDRESS,
      data,
      value: BigInt(0), // V3 uses WETH, not native ETH in the swap
    };
  }

  /**
   * Get the WETH address
   */
  getWethAddress(): Address {
    return this.WETH;
  }

  /**
   * Get the SwapRouter02 address
   */
  getSwapRouterAddress(): Address {
    return this.SWAP_ROUTER_ADDRESS;
  }

  /**
   * Get the USDC address
   */
  getUsdcAddress(): Address {
    return this.USDC;
  }
}
