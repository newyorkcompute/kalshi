---
"@newyorkcompute/kalshi-core": minor
---

Mark-to-market risk controls and settlement sync

- Add `InventoryTracker.settleMarket()` for realizing P&L at settlement
- Add `RiskManager.recordPnL()` for non-fill P&L accounting
- Bot evaluates drawdown and daily-loss limits on mark-to-market P&L every 30s
- YAML-configurable drawdown thresholds (`risk.drawdown`)
- Periodic settlement sync clears settled positions from inventory
