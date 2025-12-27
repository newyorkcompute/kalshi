# Market Maker Architecture

> **Status**: Research & Planning  
> **Last Updated**: December 2024

## Overview

A local-first market making / liquidity provider **daemon** for Kalshi prediction markets.

**Inspiration**: [greed.bot](https://greed.bot/) - "Kalshi liquidity spamming operation"

### Key Insight: Daemon vs Web Server

> The market maker should **NOT** be "an HTTP server that does market making."  
> It should be a **daemon** (background process) that:
> 1. Connects to Kalshi WebSockets (real-time data)
> 2. Computes quotes (strategy logic)
> 3. Places/cancels orders via REST
> 4. *Optionally* exposes a tiny HTTP API for control

The **quoting loop is the core process**. Hono is just a "control plane" for monitoring/control.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Node.js / Bun | Consistency with monorepo |
| **Language** | TypeScript | Type safety, existing codebase |
| **Web Framework** | [Hono](https://hono.dev/) | Lightweight, fast, modern |
| **Real-time Data** | WebSocket (already built) | Low latency orderbook updates |
| **Config** | YAML + Zod | Human-readable, validated |

---

## Package Structure

```
kalshi/
├── packages/
│   └── core/
│       └── src/
│           └── mm/                    ← NEW: MM primitives
│               ├── order-manager.ts   # Order lifecycle
│               ├── inventory.ts       # Position tracking
│               ├── risk.ts            # Risk controls
│               └── index.ts           # Exports
│
└── apps/
    └── mm/                            ← NEW: MM daemon
        ├── src/
        │   ├── main.ts                # Entry point (starts daemon)
        │   │
        │   ├── daemon/                # CORE: The quoting bot
        │   │   ├── bot.ts             # Main daemon class
        │   │   ├── runner.ts          # Quoting loop
        │   │   ├── state.ts           # Global state
        │   │   └── metrics.ts         # PnL, fills, etc.
        │   │
        │   ├── strategies/            # Quote generation
        │   │   ├── base.ts            # Strategy interface
        │   │   ├── symmetric.ts       # Simple quoting
        │   │   └── avellaneda.ts      # Avellaneda-Stoikov
        │   │
        │   ├── api/                   # OPTIONAL: Control plane (Hono)
        │   │   ├── server.ts          # Hono app
        │   │   └── routes/
        │   │       ├── health.ts      # GET /health
        │   │       ├── metrics.ts     # GET /metrics
        │   │       ├── state.ts       # GET /state (positions, orders)
        │   │       └── control.ts     # POST /pause, /resume, /flatten
        │   │
        │   └── config.ts              # Config loader
        ├── config.yaml                # Strategy config
        ├── package.json
        └── tsconfig.json
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        MM DAEMON                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  WebSocket  │───▶│   Quoting    │───▶│    REST      │   │
│  │  (realtime) │    │    Loop      │    │  (orders)    │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│         │                  │                               │
│         ▼                  ▼                               │
│  ┌─────────────┐    ┌──────────────┐                       │
│  │  Orderbook  │    │   Strategy   │                       │
│  │   State     │    │   Engine     │                       │
│  └─────────────┘    └──────────────┘                       │
│                            │                               │
│                            ▼                               │
│                     ┌──────────────┐                       │
│                     │    Risk      │                       │
│                     │   Manager    │                       │
│                     └──────────────┘                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  OPTIONAL: Hono Control Plane (HTTP API)                   │
│  /health  /metrics  /state  /pause  /resume  /flatten      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core MM Primitives (`packages/core/src/mm/`)

### Order Manager

```typescript
// order-manager.ts
import { OrdersApi } from 'kalshi-typescript';

export interface ManagedOrder {
  id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  price: number;      // cents
  count: number;
  status: 'pending' | 'open' | 'filled' | 'cancelled';
  createdAt: Date;
  filledCount: number;
}

export class OrderManager {
  private orders: Map<string, ManagedOrder> = new Map();
  private ordersApi: OrdersApi;

  constructor(ordersApi: OrdersApi) {
    this.ordersApi = ordersApi;
  }

  /** Place a new order */
  async place(order: Omit<ManagedOrder, 'id' | 'status' | 'createdAt' | 'filledCount'>): Promise<ManagedOrder>;

  /** Cancel a specific order */
  async cancel(orderId: string): Promise<void>;

  /** Cancel all orders for a ticker (or all if no ticker) */
  async cancelAll(ticker?: string): Promise<number>;

  /** Get all active orders */
  getActive(): ManagedOrder[];

  /** Bulk place orders (for two-sided quotes) */
  async placeBulk(orders: Parameters<typeof this.place>[0][]): Promise<ManagedOrder[]>;
}
```

### Inventory Tracker

```typescript
// inventory.ts
export interface Position {
  ticker: string;
  yesContracts: number;
  noContracts: number;
  netExposure: number;        // yes - no
  averageCost: number;        // cents
  unrealizedPnL: number;      // cents
}

export class InventoryTracker {
  private positions: Map<string, Position> = new Map();

  /** Update position on fill */
  onFill(fill: { ticker: string; side: 'yes' | 'no'; action: 'buy' | 'sell'; count: number; price: number }): void;

  /** Get position for a ticker */
  getPosition(ticker: string): Position | null;

  /** Get total exposure across all positions */
  getTotalExposure(): number;

  /** Get all positions */
  getAllPositions(): Position[];
}
```

### Risk Manager

```typescript
// risk.ts
export interface RiskLimits {
  maxPositionPerMarket: number;    // max contracts per ticker
  maxTotalExposure: number;        // max total contracts
  maxDailyLoss: number;            // cents
  maxOrderSize: number;            // contracts per order
  minSpread: number;               // minimum spread in cents
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export class RiskManager {
  private limits: RiskLimits;
  private dailyPnL: number = 0;
  private halted: boolean = false;

  constructor(limits: RiskLimits) {
    this.limits = limits;
  }

  /** Check if an order passes risk limits */
  checkOrder(order: { ticker: string; count: number }, inventory: InventoryTracker): RiskCheckResult;

  /** Update PnL on fill */
  onFill(pnl: number): void;

  /** Check if trading should halt */
  shouldHalt(): boolean;

  /** Emergency halt */
  halt(reason: string): void;

  /** Resume trading */
  resume(): void;

  /** Reset daily PnL (call at start of day) */
  resetDaily(): void;
}
```

---

## MM Daemon (`apps/mm/`)

### Entry Point

```typescript
// src/main.ts
import { Bot } from './daemon/bot';
import { loadConfig } from './config';
import { createControlPlane } from './api/server';

async function main() {
  const config = loadConfig();
  
  // 1. Create the bot (CORE)
  const bot = new Bot(config);
  
  // 2. Start optional control plane (HTTP API)
  if (config.api.enabled) {
    const api = createControlPlane(bot, config.api.port);
    api.start();
    console.log(`Control plane: http://localhost:${config.api.port}`);
  }
  
  // 3. Start the quoting loop
  await bot.start();
}

main().catch(console.error);
```

### Bot Class (Core Daemon)

```typescript
// src/daemon/bot.ts
import { KalshiWsClient } from '@newyorkcompute/kalshi-core';
import { OrderManager, InventoryTracker, RiskManager } from '@newyorkcompute/kalshi-core/mm';

export class Bot {
  private running = false;
  private ws: KalshiWsClient;
  private orderManager: OrderManager;
  private inventory: InventoryTracker;
  private risk: RiskManager;
  private strategy: Strategy;

  constructor(config: Config) {
    this.ws = new KalshiWsClient(config.kalshi);
    this.orderManager = new OrderManager(config.kalshi);
    this.inventory = new InventoryTracker();
    this.risk = new RiskManager(config.risk);
    this.strategy = createStrategy(config.strategy);
  }

  async start(): Promise<void> {
    this.running = true;
    
    // Connect to WebSocket
    await this.ws.connect();
    this.ws.subscribe(this.config.markets);
    
    // Register handlers
    this.ws.on('ticker', (data) => this.onTick(data));
    this.ws.on('fill', (fill) => this.onFill(fill));
    
    console.log('Bot started');
    
    // Keep alive
    while (this.running) {
      await this.sleep(1000);
    }
  }

  private async onTick(data: MarketData): Promise<void> {
    if (this.risk.shouldHalt()) return;
    
    // Generate quotes from strategy
    const quotes = this.strategy.onTick(data, this.inventory);
    
    // Risk check and place orders
    for (const quote of quotes) {
      const check = this.risk.checkOrder(quote, this.inventory);
      if (check.allowed) {
        await this.orderManager.updateQuote(quote);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.orderManager.cancelAll();
    this.ws.disconnect();
    console.log('Bot stopped');
  }

  // Control plane methods
  pause(): void { this.running = false; }
  resume(): void { this.running = true; }
  async flatten(): Promise<void> { await this.orderManager.cancelAll(); }
  getState(): BotState { /* ... */ }
}
```

### Control Plane (Optional Hono API)

```typescript
// src/api/server.ts
import { Hono } from 'hono';
import type { Bot } from '../daemon/bot';

export function createControlPlane(bot: Bot, port: number) {
  const app = new Hono();

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Metrics (PnL, fill rate, etc.)
  app.get('/metrics', (c) => c.json(bot.getMetrics()));

  // Current state (positions, active orders)
  app.get('/state', (c) => c.json(bot.getState()));

  // Control endpoints
  app.post('/pause', (c) => { bot.pause(); return c.json({ paused: true }); });
  app.post('/resume', (c) => { bot.resume(); return c.json({ paused: false }); });
  app.post('/flatten', async (c) => { await bot.flatten(); return c.json({ flattened: true }); });

  return {
    start: () => {
      console.log(`Control plane listening on :${port}`);
      // Hono serve logic
    },
    app,
  };
}
```

### API Endpoints (Control Plane)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/metrics` | PnL, fill rate, uptime |
| `GET` | `/state` | Positions, active orders, inventory |
| `POST` | `/pause` | Pause quoting (keep positions) |
| `POST` | `/resume` | Resume quoting |
| `POST` | `/flatten` | Cancel all orders, close positions |

> **Note**: The bot starts automatically on launch. These endpoints are for monitoring and emergency control.

### Strategy Interface

```typescript
// src/strategies/base.ts
import type { MarketData, Quote } from './types';

export interface Strategy {
  name: string;
  
  /** Called on each market data tick */
  onTick(data: MarketData): Quote[];
  
  /** Called when an order is filled */
  onFill(fill: Fill): void;
  
  /** Called when an order is cancelled */
  onCancel(orderId: string): void;
  
  /** Update strategy parameters */
  updateParams(params: Record<string, unknown>): void;
}

export interface Quote {
  ticker: string;
  side: 'yes' | 'no';
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
}
```

### Simple Symmetric Strategy

```typescript
// src/strategies/symmetric.ts
import type { Strategy, Quote, MarketData } from './base';

export interface SymmetricParams {
  spreadCents: number;       // Total spread (bid-ask)
  sizePerSide: number;       // Contracts per quote
  markets: string[];         // Tickers to quote
}

export class SymmetricStrategy implements Strategy {
  name = 'symmetric';
  private params: SymmetricParams;

  constructor(params: SymmetricParams) {
    this.params = params;
  }

  onTick(data: MarketData): Quote[] {
    if (!this.params.markets.includes(data.ticker)) {
      return [];
    }

    const mid = (data.yesBid + data.yesAsk) / 2;
    const halfSpread = this.params.spreadCents / 2;

    return [{
      ticker: data.ticker,
      side: 'yes',
      bidPrice: Math.floor(mid - halfSpread),
      bidSize: this.params.sizePerSide,
      askPrice: Math.ceil(mid + halfSpread),
      askSize: this.params.sizePerSide,
    }];
  }

  onFill(fill: Fill): void {
    // Could adjust quotes based on fills
  }

  onCancel(orderId: string): void {}

  updateParams(params: Partial<SymmetricParams>): void {
    this.params = { ...this.params, ...params };
  }
}
```

### Avellaneda-Stoikov Strategy

```typescript
// src/strategies/avellaneda.ts
// Based on: https://github.com/rodlaf/kalshimarketmaker

export interface AvellanedaParams {
  gamma: number;             // Risk aversion (0.1 = low, 1.0 = high)
  k: number;                 // Order arrival intensity
  sigma: number;             // Volatility estimate
  maxPosition: number;       // Max inventory per side
  markets: string[];
}

export class AvellanedaStoikov implements Strategy {
  name = 'avellaneda-stoikov';
  private params: AvellanedaParams;

  onTick(data: MarketData): Quote[] {
    const inventory = this.getInventory(data.ticker);
    const timeRemaining = this.getTimeToExpiry(data.ticker);
    
    // Reservation price (adjusted mid)
    const mid = (data.yesBid + data.yesAsk) / 2;
    const reservationPrice = mid - inventory * this.params.gamma * 
                             Math.pow(this.params.sigma, 2) * timeRemaining;
    
    // Optimal spread
    const spread = this.params.gamma * Math.pow(this.params.sigma, 2) * 
                   timeRemaining + (2 / this.params.gamma) * 
                   Math.log(1 + this.params.gamma / this.params.k);
    
    return [{
      ticker: data.ticker,
      side: 'yes',
      bidPrice: Math.floor(reservationPrice - spread / 2),
      bidSize: this.calculateSize(inventory),
      askPrice: Math.ceil(reservationPrice + spread / 2),
      askSize: this.calculateSize(-inventory),
    }];
  }
  
  // Size increases when we want to reduce inventory
  private calculateSize(inventory: number): number {
    const base = 10;
    const skew = Math.max(0, inventory) * 2; // More aggressive to reduce
    return base + skew;
  }
}
```

---

## Configuration

```yaml
# apps/mm/config.yaml
# Market Maker Daemon Configuration

# Optional HTTP control plane
api:
  enabled: true
  port: 3001
  
# Kalshi credentials (uses env vars)
kalshi:
  # KALSHI_API_KEY and KALSHI_PRIVATE_KEY from environment
  demo: false  # true for demo-api.kalshi.co

# Strategy selection
strategy:
  name: symmetric  # or 'avellaneda'
  
  # Symmetric strategy params
  symmetric:
    spreadCents: 4        # 2¢ bid, 2¢ ask
    sizePerSide: 10       # 10 contracts each side
    
  # Avellaneda params
  avellaneda:
    gamma: 0.1            # Risk aversion
    k: 1.5                # Order arrival rate
    sigma: 0.15           # Volatility
    maxPosition: 100      # Max inventory

# Markets to quote
markets:
  - PRES-2028-DEM
  - PRES-2028-GOP
  # Can use patterns later: PRES-2028-*

# Risk limits (IMPORTANT!)
risk:
  maxPositionPerMarket: 200    # contracts
  maxTotalExposure: 1000       # total contracts
  maxDailyLoss: 10000          # cents ($100)
  maxOrderSize: 50             # per order
  minSpread: 2                 # cents

# Daemon settings
daemon:
  staleOrderMs: 30000          # Cancel orders older than 30s
  reconnectDelayMs: 5000       # WebSocket reconnect delay
```

---

## Event-Driven Quoting (Not Polling)

The daemon is **event-driven**, not a polling loop. It reacts to WebSocket events:

```typescript
// src/daemon/runner.ts
export class QuotingEngine {
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /** Called on each WebSocket ticker update */
  async onTick(ticker: TickerMessage): Promise<void> {
    if (!this.bot.isRunning()) return;
    if (this.bot.risk.shouldHalt()) return;

    const market = ticker.market_ticker;
    
    // Get current state
    const position = this.bot.inventory.getPosition(market);
    const orderbook = this.bot.getOrderbook(market);
    
    // Generate new quotes
    const quotes = this.bot.strategy.computeQuotes({
      market,
      mid: (orderbook.bestBid + orderbook.bestAsk) / 2,
      spread: orderbook.bestAsk - orderbook.bestBid,
      inventory: position?.netExposure ?? 0,
    });
    
    // Update orders (cancel stale, place new)
    for (const quote of quotes) {
      const check = this.bot.risk.checkOrder(quote, this.bot.inventory);
      if (check.allowed) {
        await this.bot.orderManager.updateQuote(market, quote);
      }
    }
  }

  /** Called when our order is filled */
  async onFill(fill: FillMessage): Promise<void> {
    // Update inventory
    this.bot.inventory.onFill(fill);
    
    // Update risk PnL
    this.bot.risk.onFill(fill);
    
    // Notify strategy (may want to adjust quotes)
    this.bot.strategy.onFill(fill);
    
    // Log
    console.log(`Fill: ${fill.side} ${fill.count}x ${fill.ticker} @ ${fill.price}¢`);
  }
}
```

### Why Event-Driven?

| Polling Loop | Event-Driven |
|--------------|--------------|
| `while(true) { getMarketData(); computeQuotes(); sleep(); }` | `ws.on('ticker', onTick)` |
| Wastes cycles when nothing changes | Only runs when data arrives |
| Fixed latency (tick interval) | Minimal latency |
| Simpler to reason about | More reactive |

For market making, **event-driven is better** because:
1. React instantly to price changes
2. No wasted computation
3. Lower latency to adjust quotes

---

## Local Development

### Setup

```bash
# From monorepo root
npm install

# Create config
cp apps/mm/config.example.yaml apps/mm/config.yaml

# Set credentials
export KALSHI_API_KEY="your-api-key"
export KALSHI_PRIVATE_KEY="$(cat path/to/private.pem)"

# Start in dev mode
cd apps/mm
npm run dev
```

### Testing Locally

```bash
# Health check
curl http://localhost:3001/health

# View status
curl http://localhost:3001/status

# Start market making
curl -X POST http://localhost:3001/control/start

# Stop
curl -X POST http://localhost:3001/control/stop

# Update spread
curl -X POST http://localhost:3001/control/params \
  -H "Content-Type: application/json" \
  -d '{"spreadCents": 6}'
```

---

## Future: Deployment Options

| Platform | Pros | Cons |
|----------|------|------|
| **Local** | Simple, no cost | Latency, uptime |
| **EC2 us-east-1** | Low latency (~5ms) | Manual setup |
| **Fly.io (iad)** | Easy deploy, ~10ms | Cost |
| **Railway** | Simple, managed | Higher latency |

### EC2 Setup (Later)

```bash
# Build Docker image
docker build -t kalshi-mm .

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin
docker push $ECR_REPO/kalshi-mm

# Run on EC2
docker run -d \
  -e KALSHI_API_KEY=$KEY \
  -e KALSHI_PRIVATE_KEY="$PEM" \
  -p 3001:3001 \
  kalshi-mm
```

---

## Risk Warnings ⚠️

1. **Real Money**: This trades real money. Start with demo API!
2. **No Guarantees**: Market making can lose money
3. **Regulatory**: Understand CFTC regulations
4. **Inventory Risk**: Markets can move against you
5. **Technical Risk**: Bugs can cause large losses

**Always**:
- Start with small sizes
- Use demo environment first
- Set strict risk limits
- Monitor actively
- Have a kill switch ready

---

## Implementation Phases

### Phase 1: Core Primitives ✅ (in `kalshi-core`)
- [ ] `OrderManager` class
- [ ] `InventoryTracker` class
- [ ] `RiskManager` class
- [ ] Unit tests

### Phase 2: Basic MM Service
- [ ] Hono server setup
- [ ] Config loading (YAML + Zod)
- [ ] Health/status endpoints
- [ ] Symmetric strategy

### Phase 3: Engine & Control
- [ ] Main loop with WebSocket
- [ ] Start/stop controls
- [ ] Real-time position tracking
- [ ] Basic dashboard (optional)

### Phase 4: Advanced
- [ ] Avellaneda-Stoikov strategy
- [ ] Multiple market support
- [ ] Performance metrics
- [ ] Alerting

---

## References

- [Kalshi API Docs](https://docs.kalshi.com/)
- [Kalshi Market Maker Program](https://help.kalshi.com/markets/market-maker-program)
- [KalshiMarketMaker (Python)](https://github.com/rodlaf/kalshimarketmaker)
- [ammario/kalshi (Go)](https://github.com/ammario/kalshi)
- [Avellaneda-Stoikov Paper](https://www.math.nyu.edu/~avellane/HighFrequencyTrading.pdf)
- [Hono Framework](https://hono.dev/)

