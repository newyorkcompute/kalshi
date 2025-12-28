# @newyorkcompute/kalshi-core

## 0.6.1

### Patch Changes

- [#86](https://github.com/newyorkcompute/kalshi/pull/86) [`1e532b9`](https://github.com/newyorkcompute/kalshi/commit/1e532b919d0a4e01d571a0adde42ebcb5d0a2bca) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Fix P&L calculation bug in InventoryTracker

  - Track cost basis separately for YES and NO contracts (yesCostBasis, noCostBasis)
  - Calculate cost impact BEFORE updating position counts (was the root cause of wrong P&L)
  - Handle position flips correctly (long→short and short→long)
  - Handle short selling P&L correctly (proceeds - buy-back cost)
  - Add comprehensive P&L calculation tests

## 0.6.0

### Minor Changes

- [#81](https://github.com/newyorkcompute/kalshi/pull/81) [`cc71cbb`](https://github.com/newyorkcompute/kalshi/commit/cc71cbb360f0f6622e7ea59ce5e839317bbd7806) Thanks [@siddharthkul](https://github.com/siddharthkul)! - P0/P1 Trading Fixes for Market Maker

  ## Order Reconciliation on Startup (P0)

  - Cancel orphan orders from previous sessions on startup
  - New `cancelAllAndClear()` method with retry logic for rate limits
  - New `syncWithKalshi()` method to sync order state with API
  - New `importFromKalshi()` to import existing orders

  ## Link Fills to Order Status (P0)

  - New `onFill()` method to update order status when fills arrive
  - New `getByKalshiId()` to lookup orders by Kalshi order ID
  - Orders now correctly transition to `partial` or `filled` status

  ## Populate timeToExpiry (P0)

  - Fetch market metadata (close_time, expiration_time) on startup
  - Pass `timeToExpiry` to strategies in MarketSnapshot
  - Enables near-expiry spread widening and stop-quoting logic

  ## Stale Order Enforcement (P1)

  - New `enforceStaleOrders()` loop runs every 10 seconds
  - Cancels orders older than `daemon.staleOrderMs`
  - Cancels orders > 5¢ away from current fair value
  - New `getStaleOrders()` and `getOffPriceOrders()` helpers

  ## Rate Limit Handling

  - Added `retryWithBackoff()` helper for 429 errors
  - Exponential backoff: 2s → 4s → 8s (max 3 retries)
  - Delays between individual cancel fallbacks (200ms)

## 0.5.2

### Patch Changes

- [#77](https://github.com/newyorkcompute/kalshi/pull/77) [`8844421`](https://github.com/newyorkcompute/kalshi/commit/88444218ec5b77dc6cadc02a2dc19d2eb7123ec8) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Fix WebSocket FillMessage type to use correct Kalshi API fields (yes_price/no_price instead of price)

## 0.5.1

### Patch Changes

- [#75](https://github.com/newyorkcompute/kalshi/pull/75) [`a7c8ec6`](https://github.com/newyorkcompute/kalshi/commit/a7c8ec6175a96f04775e66891fa9b9364fe9df21) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add batch order APIs to OrderManager for improved latency

  - `batchCancel()` - cancel multiple orders in 1 API call
  - `batchCreate()` - create multiple orders in 1 API call
  - `updateQuote()` now runs batch operations in parallel (~4x faster)
  - `updateQuoteAtomic()` - sequential mode for minimal naked time

## 0.5.0

### Minor Changes

- [#69](https://github.com/newyorkcompute/kalshi/pull/69) [`29118c6`](https://github.com/newyorkcompute/kalshi/commit/29118c64ed09c13fdaa392c161dc1adbfca3be5c) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add elite MM improvements: inventory skew, local orderbook, atomic quote updates

  - **Inventory Skew**: Adaptive strategy now skews quotes based on inventory (Avellaneda-Stoikov style)
  - **LocalOrderbook**: New class to maintain orderbook from WebSocket snapshots/deltas
  - **OrderbookManager**: Manages multiple LocalOrderbook instances
  - **Microprice**: Size-weighted mid price calculation for better fair value
  - **Atomic Updates**: Place new orders before canceling old ones (no naked periods)
  - **Latency Tracking**: Track quote update latencies with percentile stats

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
