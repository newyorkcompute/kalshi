---
"@newyorkcompute/kalshi-tui": minor
---

Add Arbitrage Scanner panel to TUI

- New `Arbitrage` component displays real-time arbitrage opportunities
- Single-market arbitrage: detects when YES + NO ask prices < 100¢ (guaranteed profit)
- Event arbitrage: detects when sum of all YES prices in multi-outcome events < 100¢
- Integrated into left column layout: Markets → Arbitrage → Positions
- Opportunities sorted by profit potential, color-coded by value
- Added `event_ticker` to market data for event grouping
- 11 new unit tests for Arbitrage component

