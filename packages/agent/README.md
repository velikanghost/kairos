# Kairos Agent Backend

> NestJS backend service for automated DCA execution with MetaMask Advanced Permissions

Part of [Kairos](../../README.md) — SmartDCA with Predictive Market Intelligence.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Start PostgreSQL (via Docker)
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Start server
pnpm start:dev
```

Server runs at `http://localhost:3001`

## Key Components

| Module        | Purpose                                   |
| ------------- | ----------------------------------------- |
| `execution/`  | Trade execution using ERC-7710 delegation |
| `decision/`   | Smart sizing based on market conditions   |
| `indicators/` | Volatility, trend, liquidity analysis     |
| `scheduler/`  | Cron job checking strategies every minute |
| `indexer/`    | Envio GraphQL client for on-chain data    |

## Advanced Permissions (ERC-7710)

This service **redeems** permissions granted by users to execute trades:

📍 [execution.service.ts#L579-L592](https://github.com/velikanghost/kairos/blob/master/packages/agent/src/execution/execution.service.ts#L579-L592)

```typescript
await bundlerClient.sendUserOperationWithDelegation({
  calls: [
    {
      to: usdcAddress,
      data: transferData,
      permissionsContext: context,
      delegationManager: signerMeta.delegationManager,
    },
  ],
});
```

## Environment Variables

```env
DATABASE_URL="postgresql://..."
INDEXER_GRAPHQL_URL="http://localhost:8080/v1/graphql"
SEPOLIA_RPC_URL="https://rpc.sepolia.org"
ENCRYPTION_SECRET_KEY="64-char-hex-key"
PIMLICO_API_KEY="your-api-key"
```

## API Endpoints

- `POST /strategies` — Create DCA strategy
- `GET /strategies/user/:userId` — List user strategies
- `POST /strategies/:id/activate` — Activate strategy
- `GET /strategies/:id/executions` — Execution history

See [main README](../../README.md) for full documentation.
