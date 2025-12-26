# @newyorkcompute/kalshi-tui

## 0.2.0

### Minor Changes

- [#30](https://github.com/newyorkcompute/kalshi/pull/30) [`3c2f5bd`](https://github.com/newyorkcompute/kalshi/commit/3c2f5bdcf3a7c8bac7730512e31bbab5e2422383) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add quick wins for traders - market context, price indicators, and orderbook enhancements

  - Display relative expiry time for markets (e.g., "2d 14h", "3h 45m", "CLOSED")
  - Price change indicators with color coding (▲ green, ▼ red, ━ gray)
  - Show market title and expiry time in orderbook header
  - Display trading volume with K/M suffix formatting
  - Calculate and display bid-ask spread
  - Extract utility functions to utils.ts with comprehensive unit tests
