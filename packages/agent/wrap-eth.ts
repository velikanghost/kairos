/**
 * Wrap ETH to WETH for adding liquidity
 */

import { createPublicClient, createWalletClient, http, getAddress, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.ankr.com/eth_sepolia';
const WETH = getAddress('0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14');

const WETH_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

async function wrapETH() {
  console.log('🔄 Wrapping ETH to WETH\n');

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL),
  });

  console.log(`Using account: ${account.address}\n`);

  // Wrap 0.01 ETH to WETH (enough for liquidity)
  const amountToWrap = parseUnits('0.01', 18); // 0.01 ETH

  console.log(`Wrapping ${Number(amountToWrap) / 1e18} ETH to WETH...\n`);

  try {
    const hash = await walletClient.writeContract({
      address: WETH,
      abi: WETH_ABI,
      functionName: 'deposit',
      value: amountToWrap,
    });

    console.log(`✅ Transaction sent: ${hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ Successfully wrapped ${Number(amountToWrap) / 1e18} ETH to WETH!`);
      console.log(`Block: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed}`);
    } else {
      console.log('\n❌ Wrapping failed');
    }
  } catch (error: any) {
    console.error('\n❌ Failed to wrap ETH:', error.message);
  }
}

if (require.main === module) {
  wrapETH()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
