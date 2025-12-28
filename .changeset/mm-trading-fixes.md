---
"@newyorkcompute/kalshi-core": minor
"@newyorkcompute/kalshi-mm": minor
---

P0/P1 Trading Fixes for Market Maker

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

