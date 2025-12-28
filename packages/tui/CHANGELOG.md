# @newyorkcompute/kalshi-tui

## 0.7.0

### Minor Changes

- [#65](https://github.com/newyorkcompute/kalshi/pull/65) [`af6a100`](https://github.com/newyorkcompute/kalshi/commit/af6a1006556198030bd37e756b6375e61d0a8063) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add persistent config file and watchlist/favorites feature

  - Config stored at `~/.kalshi-tui/config.json`
  - Press `f` to toggle favorite on selected market
  - Favorites shown with ★ and sorted to top
  - Sort preference persists across sessions

## 0.6.0

### Minor Changes

- [#63](https://github.com/newyorkcompute/kalshi/pull/63) [`e46e147`](https://github.com/newyorkcompute/kalshi/commit/e46e1475e4c69d651db6b9f31f0880dd66eeaa5e) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add sort toggle to markets list

  - Press `s` to cycle through sort options: Volume → 24h → Open Interest → Price
  - Active sort column is highlighted in the header
  - Selection resets to top when sort changes

## 0.5.0

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

### Patch Changes

- Updated dependencies [[`eb5bf58`](https://github.com/newyorkcompute/kalshi/commit/eb5bf587b3b5530511f7e23f2cc5957f7da81af7)]:
  - @newyorkcompute/kalshi-core@0.3.0

## 0.4.0

### Minor Changes

- [#51](https://github.com/newyorkcompute/kalshi/pull/51) [`fc208e5`](https://github.com/newyorkcompute/kalshi/commit/fc208e5b6318773c0c77ad3d9dba19b272f46e2f) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add Arbitrage Scanner panel to TUI

  - New `Arbitrage` component displays real-time arbitrage opportunities
  - Single-market arbitrage: detects when YES + NO ask prices < 100¢ (guaranteed profit)
  - Event arbitrage: detects when sum of all YES prices in multi-outcome events < 100¢
  - Integrated into left column layout: Markets → Arbitrage → Positions
  - Opportunities sorted by profit potential, color-coded by value
  - Added `event_ticker` to market data for event grouping
  - 11 new unit tests for Arbitrage component

## 0.3.4

### Patch Changes

- [#49](https://github.com/newyorkcompute/kalshi/pull/49) [`4342fed`](https://github.com/newyorkcompute/kalshi/commit/4342feddc7f14c840f043638b365592201abd30d) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add loading indicators and offline detection

  - Add animated Spinner component with braille frames
  - Show spinner during initial data loading
  - Show refresh indicator (↻) when updating in background
  - Detect network errors and show offline status (⊘)
  - Display last update timestamp ("30s ago")
  - Auto-retry when connection is restored

## 0.3.3

### Patch Changes

- [#39](https://github.com/newyorkcompute/kalshi/pull/39) [`3152259`](https://github.com/newyorkcompute/kalshi/commit/3152259e6c39b726deecfe387895b14e52634546) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add shared utilities to kalshi-core for building Kalshi applications:

  **New in @newyorkcompute/kalshi-core:**

  - TTL Cache (`getCached`, `setCache`, `clearCache`, `clearAllCache`, `CACHE_TTL`)
  - Rate Limiter with exponential backoff and circuit breaker (`createRateLimiter`, `isRateLimitError`)
  - Enhanced formatting: `formatExpiry` for market close times, `calculateSpread` for orderbook spread

  **@newyorkcompute/kalshi-tui:**

  - Now re-exports cache and formatting utilities from core for backwards compatibility

- Updated dependencies [[`3152259`](https://github.com/newyorkcompute/kalshi/commit/3152259e6c39b726deecfe387895b14e52634546)]:
  - @newyorkcompute/kalshi-core@0.2.0

## 0.3.2

### Patch Changes

- [#37](https://github.com/newyorkcompute/kalshi/pull/37) [`aa52bba`](https://github.com/newyorkcompute/kalshi/commit/aa52bbabe7a3e58575864ad5374ce28c8b6f52b9) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add 24h volume and open interest metrics to markets list:
  - Display column headers (Vol, 24h, OI, Exp, Price) for clarity
  - Show 24h volume to identify recently active markets
  - Show open interest to gauge total money at stake
  - Color-coded metrics for quick scanning
- Updated dependencies [[`aa52bba`](https://github.com/newyorkcompute/kalshi/commit/aa52bbabe7a3e58575864ad5374ce28c8b6f52b9)]:
  - @newyorkcompute/kalshi-core@0.1.1

## 0.3.1

### Patch Changes

- [#35](https://github.com/newyorkcompute/kalshi/pull/35) [`617152b`](https://github.com/newyorkcompute/kalshi/commit/617152b1c0176c2b1e183d7e3218398e896f50ff) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Enhanced orderbook with more trading data:
  - Increase price levels from 5 to 8 for better depth visibility
  - Add mid price display in header
  - Add total depth (ask qty / bid qty) summary
  - Add imbalance ratio with sentiment indicator (buyers/sellers/neutral)
  - Add dollar value at each price level
  - Highlight best bid/ask with arrows (BID▸/ASK▸)
  - Improved bar visualization with background
  - Better price formatting for small values (<1¢)

## 0.3.0

### Minor Changes

- [#34](https://github.com/newyorkcompute/kalshi/pull/34) [`70bb57f`](https://github.com/newyorkcompute/kalshi/commit/70bb57f6b30a21daa424a14cbdc95a8ede24254b) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add stability fixes, historical price charts, and UX improvements

  Stability:

  - Rate limiting with exponential backoff (2x delay on 429 errors, max 5 min)
  - Circuit breaker after 5 consecutive failures
  - 30-second request timeouts on all API calls
  - Error boundary for graceful crash handling
  - Simple TTL cache for price history (5 min cache)

  Features:

  - Historical price charts using asciichart library
  - Charts fill full width with interpolation for smooth visualization
  - Orderbook and price chart displayed simultaneously (no toggle needed)
  - Shows price change %, high/low, trade count
  - Rate limit status indicator in header

  UX Improvements:

  - Markets sorted by volume (highest first)
  - Fixed expiry formatting for distant dates (shows years, "distant" for >10y)
  - Volume displayed alongside expiry in market list
  - Better layout: orderbook (top) + chart (bottom) in right column

## 0.2.0

### Minor Changes

- [#30](https://github.com/newyorkcompute/kalshi/pull/30) [`3c2f5bd`](https://github.com/newyorkcompute/kalshi/commit/3c2f5bdcf3a7c8bac7730512e31bbab5e2422383) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add quick wins for traders - market context, price indicators, and orderbook enhancements

  - Display relative expiry time for markets (e.g., "2d 14h", "3h 45m", "CLOSED")
  - Price change indicators with color coding (▲ green, ▼ red, ━ gray)
  - Show market title and expiry time in orderbook header
  - Display trading volume with K/M suffix formatting
  - Calculate and display bid-ask spread
  - Extract utility functions to utils.ts with comprehensive unit tests
