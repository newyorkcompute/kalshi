# Market Maker Architecture

> **Status**: Research & Planning  
> **Last Updated**: December 2024

## Overview

A local-first market making / liquidity provider system for Kalshi prediction markets.

**Inspiration**: [greed.bot](https://greed.bot/) - "Kalshi liquidity spamming operation"

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
    └── mm/                            ← NEW: MM service
        ├── src/
        │   ├── server.ts              # Hono app entry
        │   ├── routes/
        │   │   ├── health.ts          # Health check
        │   │   ├── status.ts          # Current state
        │   │   ├── orders.ts          # Order management
        │   │   └── control.ts         # Start/stop/params
        │   ├── strategies/
        │   │   ├── base.ts            # Strategy interface
        │   │   ├── symmetric.ts       # Simple quoting
        │   │   └── avellaneda.ts      # Avellaneda-Stoikov
        │   ├── engine/
        │   │   ├── runner.ts          # Main loop
        │   │   ├── state.ts           # Global state
        │   │   └── metrics.ts         # PnL, fills, etc.
        │   └── config.ts              # Config loader
        ├── config.yaml                # Strategy config
        ├── package.json
        └── tsconfig.json
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

## MM Service (`apps/mm/`)

### Hono Server

```typescript
// src/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health';
import { statusRoutes } from './routes/status';
import { controlRoutes } from './routes/control';
import { Engine } from './engine/runner';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Routes
app.route('/health', healthRoutes);
app.route('/status', statusRoutes);
app.route('/control', controlRoutes);

// Start engine
const engine = new Engine();

export default {
  port: process.env.MM_PORT || 3001,
  fetch: app.fetch,
  engine,
};
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/status` | Current state (positions, orders, PnL) |
| `GET` | `/status/orders` | Active orders |
| `GET` | `/status/positions` | Current positions |
| `GET` | `/status/pnl` | PnL summary |
| `POST` | `/control/start` | Start market making |
| `POST` | `/control/stop` | Stop (cancel all orders) |
| `POST` | `/control/halt` | Emergency halt |
| `POST` | `/control/params` | Update strategy params |
| `GET` | `/control/config` | Current config |

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
# Market Maker Configuration

server:
  port: 3001
  
kalshi:
  # Uses env vars: KALSHI_API_KEY, KALSHI_PRIVATE_KEY
  demo: false  # true for demo-api.kalshi.co

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

markets:
  - PRES-2028-DEM
  - PRES-2028-GOP
  # Can use patterns later: PRES-2028-*

risk:
  maxPositionPerMarket: 200    # contracts
  maxTotalExposure: 1000       # total contracts
  maxDailyLoss: 10000          # cents ($100)
  maxOrderSize: 50             # per order
  minSpread: 2                 # cents

engine:
  tickIntervalMs: 1000         # Quote refresh rate
  staleOrderMs: 30000          # Cancel orders older than
  useWebsocket: true           # Use WS for real-time data
```

---

## Main Loop (Engine)

```typescript
// src/engine/runner.ts
import { KalshiWsClient } from '@newyorkcompute/kalshi-core';

export class Engine {
  private running = false;
  private strategy: Strategy;
  private orderManager: OrderManager;
  private inventory: InventoryTracker;
  private risk: RiskManager;
  private ws: KalshiWsClient;

  async start(): Promise<void> {
    this.running = true;
    
    // Connect WebSocket
    await this.ws.connect();
    
    // Subscribe to markets
    this.ws.subscribe(this.config.markets);
    
    // Main loop
    while (this.running) {
      // Check if halted
      if (this.risk.shouldHalt()) {
        await this.cancelAllOrders();
        continue;
      }
      
      // Get latest data
      const marketData = this.ws.getLatestData();
      
      // Generate quotes
      const quotes = this.strategy.onTick(marketData);
      
      // Risk check each quote
      for (const quote of quotes) {
        const check = this.risk.checkOrder(quote, this.inventory);
        if (!check.allowed) {
          console.log(`Quote rejected: ${check.reason}`);
          continue;
        }
        
        // Place/update orders
        await this.updateQuotes(quote);
      }
      
      // Refresh cycle
      await this.sleep(this.config.tickIntervalMs);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.cancelAllOrders();
    this.ws.disconnect();
  }
}
```

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

