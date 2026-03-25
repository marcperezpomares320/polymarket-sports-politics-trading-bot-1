# Polymarket Sports & Politics Trading Bot

A **Polymarket copy bot** for copy trading on Polymarket prediction markets, specifically optimized for **sports and politics markets**. Watches a target wallet and automatically copies `BUY` and `SELL` trades with configurable sizing and risk caps.

**Keywords:** polymarket trading bot, polymarket copy bot, polymarket copy trading bot, sports trading, politics trading, prediction market bot, automated trading

## Features

- **Category Filtering**: Only trades in sports and politics markets (configurable)
- **Modular Architecture**: Well-structured codebase with separated concerns
- **Type Safety**: Full TypeScript support with strict typing
- **WebSocket & REST**: Dual monitoring for real-time and polled trades
- **Risk Management**: Configurable position and session limits
- **Position Tracking**: Automatic position reconciliation and management

## Project Structure

```
src/
├── core/                 # Main application logic
│   ├── bot.ts           # Main bot orchestrator
│   └── trade-handler.ts # Trade processing logic
├── services/            # Business logic services
│   ├── monitor/         # Trade monitoring services
│   │   ├── trade-monitor.ts
│   │   └── websocket-monitor.ts
│   └── trader/          # Trading services
│       ├── trade-executor.ts
│       ├── position-tracker.ts
│       └── risk-manager.ts
├── config/              # Configuration management
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── logger.ts
└── scripts/             # CLI scripts
    ├── generate-api-creds.ts
    └── test-api-creds.ts
```

## Prerequisites

- Node.js 18+ and npm
- Polygon EOA funded with `USDC.e` collateral and `POL` (MATIC) for gas
- Polymarket account tied to the same EOA/private key
- Polygon RPC URL (QuickNode recommended)

## Prerequisites

- Node.js 18+ and npm
- Polygon EOA funded with `USDC.e` collateral and `POL` (MATIC) for gas
- Polymarket account tied to the same EOA/private key
- Polygon RPC URL (QuickNode recommended)

## Region Restrictions

Polymarket restricts access in some regions. **If you are in a restricted region, the bot will not work** — you will see connection or Cloudflare/geo errors. In that case, route traffic through a proxy or VPN (many free proxy services are available). Run the bot from an environment where Polymarket is accessible.

## Credentials

- The bot derives/creates User CLOB credentials from `PRIVATE_KEY` at startup.
- Builder dashboard keys are for attribution and are not valid trading auth credentials for order placement.

## Development

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create your local env file:
```bash
cp .env.example .env
```

3. Fill required values in `.env`

### Scripts

- `npm start` - Start the bot
- `npm run dev` - Start in development mode with watch
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run clean` - Clean build artifacts

### Code Quality

This project uses:
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Jest** for testing
- **Husky** for git hooks (planned)

4. (Optional) Generate and inspect user API credentials:

```bash
npm run generate-api-creds
```

## Run

```bash
npm start
```

Dev/watch mode:

```bash
npm run dev
```

Build + run compiled output:

```bash
npm run build
npm run start:prod
```

## Key Environment Variables

- `TARGET_WALLET`: wallet to follow
- `PRIVATE_KEY`: your EOA private key used for signing/approvals/trades
- `RPC_URL`: Polygon JSON-RPC endpoint
- `USE_WEBSOCKET`: `true|false`
- `USE_USER_CHANNEL`: `true|false` (`true` requires valid API creds for WS auth)
- `POSITION_MULTIPLIER`: copied size multiplier (e.g. `0.1`)
- `MAX_TRADE_SIZE`, `MIN_TRADE_SIZE`
- `SLIPPAGE_TOLERANCE`: e.g. `0.02`
- `ORDER_TYPE`: `LIMIT`, `FOK`, or `FAK`
- `COPY_SELLS`: `true|false` — copy SELL trades in addition to BUY (default: true)
- `EXIT_AFTER_FIRST_SELL_COPY`: `true|false` — exit successfully after first SELL is copied (default: false)
- `MAX_SESSION_NOTIONAL`, `MAX_PER_MARKET_NOTIONAL`: `0` disables caps
- `ALLOWED_CATEGORIES`: comma-separated list of market categories to trade (e.g. `sports,politics`; default: `sports,politics`)

See `.env.example` for the full list.

## Notes

- Also known as: polymarket copy bot, polymarket copy trading, polymarket copy trading bot.
- The bot starts copying only trades that happen after startup time.
- User API credentials are derived/generated from `PRIVATE_KEY` at startup.
- Frequent WebSocket disconnect/reconnect can happen; REST polling remains active as fallback.

## Security

- Never commit `.env`.
- Use a dedicated wallet for bot trading.
- Start with small limits before increasing size.
