---
"@newyorkcompute/kalshi-core": minor
"@newyorkcompute/kalshi-tui": patch
---

Add shared utilities to kalshi-core for building Kalshi applications:

**New in @newyorkcompute/kalshi-core:**
- TTL Cache (`getCached`, `setCache`, `clearCache`, `clearAllCache`, `CACHE_TTL`)
- Rate Limiter with exponential backoff and circuit breaker (`createRateLimiter`, `isRateLimitError`)
- Enhanced formatting: `formatExpiry` for market close times, `calculateSpread` for orderbook spread

**@newyorkcompute/kalshi-tui:**
- Now re-exports cache and formatting utilities from core for backwards compatibility
