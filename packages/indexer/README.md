# Kairos Indexer

> Envio HyperIndex for Uniswap V4 on-chain data

Part of [Kairos](../../README.md) — SmartDCA with Predictive Market Intelligence.

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate types from schema
pnpm codegen

# Start indexer (requires Docker)
pnpm dev
```

GraphQL Playground: `http://localhost:8080` (password: `testing`)

## What We Index

| Contract        | Events                                  | Purpose                       |
| --------------- | --------------------------------------- | ----------------------------- |
| PoolManager     | `Swap`, `ModifyLiquidity`, `Initialize` | Price, volume, liquidity data |
| PositionManager | `Transfer`, `Subscription`              | Position tracking             |

**Network**: Ethereum Sepolia (Chain ID: 11155111)

## Envio Usage

📍 **Event Handlers**: [EventHandlers.ts](https://github.com/velikanghost/kairos/blob/master/packages/indexer/src/EventHandlers.ts#L122-L138)

```typescript
PoolManager.Swap.handler(async ({ event, context }) => {
  context.PoolManager_Swap.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount0: event.params.amount0,
    amount1: event.params.amount1,
    sqrtPriceX96: event.params.sqrtPriceX96,
    liquidity: event.params.liquidity,
    // ...
  })
})
```

📍 **Config**: [config.yaml](https://github.com/velikanghost/kairos/blob/master/packages/indexer/config.yaml)

📍 **Schema**: [schema.graphql](https://github.com/velikanghost/kairos/blob/master/packages/indexer/schema.graphql)

## GraphQL Queries

```graphql
# Get latest swaps
query {
  PoolManager_Swap(limit: 10, order_by: { timestamp: desc }) {
    sqrtPriceX96
    amount0
    amount1
    timestamp
  }
}

# Get liquidity events
query {
  PoolManager_ModifyLiquidity {
    liquidityDelta
    timestamp
  }
}
```

## Development

```bash
pnpm codegen    # Regenerate types after schema changes
pnpm dev        # Start with TUI
TUI_OFF=true pnpm dev  # Start without TUI (for debugging)
```

See [main README](../../README.md) for full documentation.
