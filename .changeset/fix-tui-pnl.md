---
"@newyorkcompute/kalshi-tui": patch
---

fix(tui): use realized_pnl from Kalshi API instead of incorrect calculation

The P&L display was incorrectly using market_exposure as cost basis. Now uses
realized_pnl directly from Kalshi API for accurate P&L tracking.
