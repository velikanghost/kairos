# Kairos

**SmartDCA with Predictive Market Intelligence** — Automated Dollar-Cost Averaging powered by MetaMask Advanced Permissions (ERC-7715/7710) and Envio HyperIndex.

## Overview

Kairos is an intelligent DCA (Dollar-Cost Averaging) trading bot that allows users to set up automated trading strategies without signing each transaction manually. By leveraging **MetaMask Advanced Permissions**, users grant time-limited, capped allowances to a session account that executes trades on their behalf.

### Key Features

- 🔐 **Permission-Based Trading**: No wallet custody — users maintain full control via ERC-7715 permissions
- 🤖 **Smart Execution**: AI-powered decision engine adapts trade size based on market conditions
- 📊 **Market Intelligence**: Real-time volatility analysis, trend detection, and liquidity scoring
- ⚡ **Automated Scheduling**: Strategies execute automatically (5min, hourly, daily, weekly)
- 🔔 **Real-Time Updates**: WebSocket notifications for instant execution feedback
- 📈 **Portfolio Tracking**: P&L charts and performance analytics

### How It Works

1. **Connect Wallet**: User connects their MetaMask wallet
2. **Create Session Account**: A MetaMask Smart Account is created for automated execution
3. **Grant Permissions**: User grants a daily USDC allowance (e.g., 50 USDC/day) via ERC-7715
4. **Create Strategy**: Configure DCA parameters (pair, frequency, amount)
5. **Automated Execution**: Backend analyzes market conditions and executes optimal trades

---

## Architecture

```
kairos/
├── packages/
│   ├── agent/          # NestJS Backend (Port 3001)
│   │   ├── src/
│   │   │   ├── decision/       # Smart execution decision engine
│   │   │   ├── execution/      # Trade execution with ERC-7710
│   │   │   ├── indexer/        # Envio GraphQL client
│   │   │   ├── indicators/     # Market analysis (volatility, MA, trends)
│   │   │   ├── scheduler/      # Cron-based strategy checker
│   │   │   ├── notifications/  # WebSocket gateway
│   │   │   └── ...
│   │   └── prisma/             # PostgreSQL schema
│   │
│   ├── frontend/       # Next.js 16 + React 19 (Port 3000)
│   │   └── src/
│   │       ├── app/            # Pages (overview, strategies, portfolio, history)
│   │       ├── components/     # UI components
│   │       └── providers/      # Context providers (Session, Permission, etc.)
│   │
│   └── indexer/        # Envio HyperIndex
│       ├── src/
│       │   └── EventHandlers.ts  # Uniswap V4 event handlers
│       ├── schema.graphql        # GraphQL schema
│       └── config.yaml           # Indexer configuration
```

### Tech Stack

| Component      | Technology                                       |
| -------------- | ------------------------------------------------ |
| Backend        | NestJS, Prisma, PostgreSQL                       |
| Frontend       | Next.js 16, React 19, Wagmi v3, TailwindCSS v4   |
| Indexer        | Envio HyperIndex                                 |
| Smart Accounts | MetaMask Smart Accounts Kit                      |
| Permissions    | ERC-7715 (Request) + ERC-7710 (Redeem)           |
| Bundler        | Pimlico (with paymaster for gas sponsorship)     |
| DEX            | Uniswap V3 SwapRouter02                          |
| Price Feeds    | Pyth Network (real-time), CoinGecko (historical) |
| Network        | Ethereum Sepolia Testnet                         |

---

## Advanced Permissions Usage

Kairos uses **MetaMask Advanced Permissions** to enable automated trading without requiring users to sign each transaction. This is achieved through:

- **ERC-7715**: Request periodic token allowances from users
- **ERC-7710**: Redeem those permissions to execute trades via delegation

### Requesting Advanced Permissions (ERC-7715)

Users grant daily USDC allowances through the `requestExecutionPermissions` API. The permission includes:

- Token address (USDC)
- Period amount (e.g., 50 USDC)
- Period duration (24 hours)
- Expiry (30 days)

**📍 Code Link:**
[`packages/frontend/src/components/GrantPermissionsButton.tsx#L75-L88`](https://github.com/velikanghost/kairos/blob/master/packages/frontend/src/components/GrantPermissionsButton.tsx#L75-L88)

```typescript
const permissions = await client.requestExecutionPermissions([
  {
    chainId,
    expiry,
    signer: {
      type: 'account',
      data: {
        address: sessionAccountAddress as `0x${string}`,
      },
    },
    isAdjustmentAllowed: true,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress: USDC_ADDRESS,
        periodAmount: parseUnits(amount, 6),
        periodDuration: 86400, // 1 day
      },
    },
  },
])
```

### Redeeming Advanced Permissions (ERC-7710)

The backend uses `sendUserOperationWithDelegation` to transfer USDC from the user's wallet to the session account using the granted permission. This enables gasless, automated trade execution.

**📍 Code Link:**
[`packages/agent/src/execution/execution.service.ts#L579-L592`](https://github.com/velikanghost/kairos/blob/master/packages/agent/src/execution/execution.service.ts#L579-L592)

```typescript
const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
  publicClient,
  account: smartAccount,
  calls: [
    {
      to: usdcAddress, // USDC token contract
      data: transferData, // transfer(sessionAccount, amount)
      value: BigInt(0),
      permissionsContext: context,
      delegationManager: signerMeta.delegationManager,
    },
  ],
  ...fee,
})
```

---

## Envio Usage

Kairos uses **Envio HyperIndex** to index Uniswap V4 events on Sepolia, providing real-time on-chain data for market analysis.

### How We Use Envio

1. **Index Swap Events**: Track all swaps on Uniswap V4 PoolManager for price and volume data
2. **Index Liquidity Events**: Monitor `ModifyLiquidity` events to calculate liquidity scores
3. **Query via GraphQL**: The agent backend queries indexed data for market indicators

### Envio Code Links

**📍 Event Handlers (Indexer):**
[`packages/indexer/src/EventHandlers.ts#L122-L138`](https://github.com/velikanghost/kairos/blob/master/packages/indexer/src/EventHandlers.ts#L122-L138)

```typescript
PoolManager.Swap.handler(async ({ event, context }) => {
  const entity: PoolManager_Swap = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    event_id: event.params.id,
    sender: event.params.sender,
    amount0: event.params.amount0,
    amount1: event.params.amount1,
    sqrtPriceX96: event.params.sqrtPriceX96,
    liquidity: event.params.liquidity,
    tick: event.params.tick,
    fee: event.params.fee,
    blockNumber: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
  }
  context.PoolManager_Swap.set(entity)
})
```

**📍 Indexer Configuration:**
[`packages/indexer/config.yaml`](https://github.com/velikanghost/kairos/blob/master/packages/indexer/config.yaml)

**📍 GraphQL Schema:**
[`packages/indexer/schema.graphql`](https://github.com/velikanghost/kairos/blob/master/packages/indexer/schema.graphql)

**📍 Querying Indexed Data (Agent Backend):**
[`packages/agent/src/indexer/indexer.service.ts#L30-L65`](https://github.com/velikanghost/kairos/blob/master/packages/agent/src/indexer/indexer.service.ts#L30-L65)

```typescript
const query = gql`
  query GetLatestSwap($limit: Int!) {
    PoolManager_Swap(limit: $limit, order_by: { timestamp: desc }) {
      sqrtPriceX96
      blockNumber
      timestamp
    }
  }
`
const data = await this.client.request(query, { limit: 1 })
```

### Indexed Contracts

| Contract                   | Address                                      | Events                            |
| -------------------------- | -------------------------------------------- | --------------------------------- |
| Uniswap V4 PoolManager     | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Swap, Initialize, ModifyLiquidity |
| Uniswap V4 PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | Transfer, Subscription            |

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker (for PostgreSQL and Envio)
- MetaMask Flask (for Advanced Permissions support)

### Installation

```bash
# Clone the repository
git clone https://github.com/velikanghost/kairos.git
cd kairos

# Install dependencies
pnpm install
```

### Environment Setup

Create `.env` files in each package:

**`packages/agent/.env`**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/kairos"
INDEXER_GRAPHQL_URL="http://localhost:8080/v1/graphql"
SEPOLIA_RPC_URL="https://rpc.sepolia.org"
ENCRYPTION_SECRET_KEY="your-64-char-hex-key"
PIMLICO_API_KEY="your-pimlico-api-key"
CORS_ORIGIN="http://localhost:3000"
```

**`packages/frontend/.env.local`**

```env
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://rpc.sepolia.org"
```

### Running the Project

```bash
# Terminal 1: Start the indexer
pnpm dev:indexer

# Terminal 2: Start the agent backend
pnpm dev:agent

# Terminal 3: Start the frontend
pnpm dev:frontend
```

Visit `http://localhost:3000` to access the application.

---

## Smart Features

### Market Intelligence

| Feature                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| **Volatility Analysis** | Coefficient of variation over 24h prices                 |
| **Trend Detection**     | MA7 vs MA30 crossover analysis (bullish/bearish/neutral) |
| **Liquidity Scoring**   | 0-1 score based on pool depth and flow momentum          |
| **Dip Detection**       | Increases position size on 5-10% price drops             |

### Trade Optimization

- **Smart Sizing**: Adjusts trade amounts based on market conditions
- **Volatility Adjustment**: Reduces size in high volatility (>10%)
- **Liquidity Check**: Ensures sufficient pool depth before trading
- **Daily Allowance Tracking**: Prevents exceeding granted permissions

---

## Social Media

Follow our journey building Kairos with MetaMask Advanced Permissions!

🐦 **Twitter/X**: [Project Showcase Post](https://x.com/velkan_gst/status/2005959387047727285)

Built with [@MetaMaskDev](https://x.com/MetaMaskDev) Advanced Permissions (ERC-7715/7710) — enabling secure, automated DCA trading with user-controlled spending limits.

---

## Acknowledgments

- [MetaMask](https://metamask.io/) — Advanced Permissions (ERC-7715/7710) and Smart Accounts Kit
- [Envio](https://envio.dev/) — HyperIndex for fast blockchain indexing
- [Pimlico](https://pimlico.io/) — Bundler and paymaster infrastructure
- [Uniswap](https://uniswap.org/) — V3/V4 DEX infrastructure
- [Pyth Network](https://pyth.network/) — Real-time price feeds
