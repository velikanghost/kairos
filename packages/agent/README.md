# Kairos Agent Backend

> Intelligent backend service for Kairos - SmartDCA with Predictive Market Intelligence on Monad

## Overview

This NestJS backend provides market intelligence and automated decision-making for DCA (Dollar-Cost Averaging) strategies using MetaMask Advanced Permissions (ERC-7715).

### Key Features

✅ **Market Intelligence**: Analyzes volatility, trends, liquidity from blockchain data
✅ **Smart Execution**: Adapts trade size based on market conditions
✅ **Automated Scheduler**: Checks strategies every minute
✅ **Real-time Notifications**: WebSocket integration for instant updates
✅ **Permission-based**: No wallet custody, users maintain control via MetaMask
✅ **Risk Management**: Reduces size in high volatility, increases on dips

## Architecture

```
src/
├── config/        # Environment configuration
├── prisma/        # Database service (PostgreSQL)
├── indexer/       # GraphQL client for blockchain data
├── indicators/    # Market analysis (volatility, MA, trends)
├── decision/      # Smart execution decision engine
├── strategies/    # DCA strategy CRUD API
├── scheduler/     # Cron-based execution checker
├── notifications/ # WebSocket gateway
└── common/        # Shared types, DTOs, utilities
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
pnpm start:dev
```

The server will start on [http://localhost:3001](http://localhost:3001)

## Environment Variables

See [.env.example](./.env.example) for required configuration:
- `DATABASE_URL`: PostgreSQL connection string
- `INDEXER_GRAPHQL_URL`: Blockchain indexer endpoint (default: http://localhost:8080/v1/graphql)
- `PORT`: Server port (default: 3001)
- `CORS_ORIGIN`: Frontend URL (default: http://localhost:3000)

## API Documentation

### REST Endpoints

#### Strategies
- `POST /strategies` - Create new DCA strategy
- `GET /strategies/user/:userId` - Get all strategies for user
- `GET /strategies/:id` - Get single strategy
- `PATCH /strategies/:id` - Update strategy
- `DELETE /strategies/:id` - Delete strategy
- `POST /strategies/:id/activate` - Activate strategy
- `POST /strategies/:id/deactivate` - Deactivate strategy
- `GET /strategies/:id/executions` - Get execution history

### WebSocket Events

#### Client → Server
- `execution:completed` - Confirm execution success
- `execution:failed` - Report execution failure
- `market:subscribe` - Subscribe to pair updates
- `market:unsubscribe` - Unsubscribe from pair

#### Server → Client
- `execution:ready` - New execution opportunity
- `market:update` - Real-time market data

## How It Works

### 1. User Creates Strategy (Frontend)
User grants permission via MetaMask Advanced Permissions, frontend sends strategy to backend

### 2. Scheduler Evaluates (Every Minute)
Backend checks active strategies, analyzes market conditions using indicators service

### 3. Decision Engine
Calculates optimal execution based on:
- Volatility (buy less in high volatility)
- Price dips (buy more on -5% or -10% drops)
- Liquidity score (reduce size if low)
- Trend analysis (MA crossovers)

### 4. WebSocket Notification
If conditions are good, backend notifies frontend via WebSocket

### 5. Frontend Executes
Uses granted permission to execute transaction, confirms back to backend

## Database Schema

### DCAStrategy
Stores user DCA configurations with smart features toggle

### Execution
Records all execution attempts with decision metadata and market conditions

### MarketSnapshot
Cached market indicators for performance

## Development

```bash
# Run tests
pnpm test

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio

# Lint & format
pnpm lint
pnpm format
```

## License

UNLICENSED - Private use only
