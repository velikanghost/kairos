# Kairos Frontend

> Next.js dashboard for automated DCA trading with MetaMask Advanced Permissions

Part of [Kairos](../../README.md) — SmartDCA with Predictive Market Intelligence.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Start development server
pnpm dev
```

App runs at `http://localhost:3000`

## Tech Stack

- **Next.js 16** + **React 19**
- **Wagmi v3** + **viem** for blockchain interactions
- **TailwindCSS v4** for styling
- **Recharts** for P&L visualization
- **Socket.io** for real-time updates

## Pages

| Route         | Description                  |
| ------------- | ---------------------------- |
| `/`           | Landing + wallet connect     |
| `/overview`   | Stats dashboard + P&L chart  |
| `/strategies` | Create/manage DCA strategies |
| `/portfolio`  | Holdings + performance       |
| `/history`    | Execution history            |

## Advanced Permissions (ERC-7715)

This app **requests** permissions from users via MetaMask:

📍 [GrantPermissionsButton.tsx#L75-L88](https://github.com/velikanghost/kairos/blob/master/packages/frontend/src/components/GrantPermissionsButton.tsx#L75-L88)

```typescript
const permissions = await client.requestExecutionPermissions([
  {
    chainId,
    expiry,
    signer: { type: 'account', data: { address: sessionAccountAddress } },
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress: USDC_ADDRESS,
        periodAmount: parseUnits(amount, 6),
        periodDuration: 86400,
      },
    },
  },
])
```

## Environment Variables

```env
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://rpc.sepolia.org"
```

## Key Components

- `GrantPermissionsButton` — ERC-7715 permission request
- `CreateStrategyForm` — DCA strategy configuration
- `ExecutionHistory` — Trade history with filters
- `PnLChart` — Portfolio performance visualization
- `PortfolioOverview` — Holdings summary

See [main README](../../README.md) for full documentation.
