---
"@newyorkcompute/kalshi-core": patch
---

Add batch order APIs to OrderManager for improved latency

- `batchCancel()` - cancel multiple orders in 1 API call
- `batchCreate()` - create multiple orders in 1 API call
- `updateQuote()` now runs batch operations in parallel (~4x faster)
- `updateQuoteAtomic()` - sequential mode for minimal naked time
