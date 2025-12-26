# @newyorkcompute/kalshi-tui

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
