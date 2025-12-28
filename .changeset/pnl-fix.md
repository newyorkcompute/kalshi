---
"@newyorkcompute/kalshi-core": patch
---

Fix P&L calculation bug in InventoryTracker

- Track cost basis separately for YES and NO contracts (yesCostBasis, noCostBasis)
- Calculate cost impact BEFORE updating position counts (was the root cause of wrong P&L)
- Handle position flips correctly (long→short and short→long)
- Handle short selling P&L correctly (proceeds - buy-back cost)
- Add comprehensive P&L calculation tests
