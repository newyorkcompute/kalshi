# @newyorkcompute/kalshi-core

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
