# @newyorkcompute/kalshi-core

## 0.4.0

### Minor Changes

- [#57](https://github.com/newyorkcompute/kalshi/pull/57) [`54c1ad3`](https://github.com/newyorkcompute/kalshi/commit/54c1ad3b38852309eade63b01793941d9de23f04) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add market making primitives:
  - `OrderManager`: Order lifecycle management with bulk operations
  - `InventoryTracker`: Position tracking and PnL calculation
  - `RiskManager`: Risk limits enforcement (position, exposure, daily loss)
  - New types: `ManagedOrder`, `Quote`, `Position`, `Fill`, `PnLSummary`

## 0.3.0

### Minor Changes

- [#53](https://github.com/newyorkcompute/kalshi/pull/53) [`eb5bf58`](https://github.com/newyorkcompute/kalshi/commit/eb5bf587b3b5530511f7e23f2cc5957f7da81af7) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add WebSocket support for real-time market data

  **kalshi-core:**

  - New `KalshiWsClient` class for WebSocket connections
  - Supports `ticker`, `orderbook_delta`, `trade`, and `fill` channels
  - Automatic reconnection with exponential backoff
  - RSA-PSS authentication for secure connections
  - Ping/pong heartbeat for connection health
  - New exports: `KalshiWsClient`, `generateWsAuthHeaders`, `generateSignedWsUrl`
  - 10 new unit tests for WebSocket auth and types

  **kalshi-tui:**

  - New `useKalshiWs` hook for React components
  - Real-time ticker updates with automatic state management
  - Orderbook delta handling with level updates
  - Trade feed with recent trades buffer
  - Easy subscription management (subscribe/unsubscribe)

## 0.2.0

### Minor Changes

- [#39](https://github.com/newyorkcompute/kalshi/pull/39) [`3152259`](https://github.com/newyorkcompute/kalshi/commit/3152259e6c39b726deecfe387895b14e52634546) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add shared utilities to kalshi-core for building Kalshi applications:

  **New in @newyorkcompute/kalshi-core:**

  - TTL Cache (`getCached`, `setCache`, `clearCache`, `clearAllCache`, `CACHE_TTL`)
  - Rate Limiter with exponential backoff and circuit breaker (`createRateLimiter`, `isRateLimitError`)
  - Enhanced formatting: `formatExpiry` for market close times, `calculateSpread` for orderbook spread

  **@newyorkcompute/kalshi-tui:**

  - Now re-exports cache and formatting utilities from core for backwards compatibility

## 0.1.1

### Patch Changes

- [#37](https://github.com/newyorkcompute/kalshi/pull/37) [`aa52bba`](https://github.com/newyorkcompute/kalshi/commit/aa52bbabe7a3e58575864ad5374ce28c8b6f52b9) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add 24h volume and open interest metrics to markets list:
  - Display column headers (Vol, 24h, OI, Exp, Price) for clarity
  - Show 24h volume to identify recently active markets
  - Show open interest to gauge total money at stake
  - Color-coded metrics for quick scanning
