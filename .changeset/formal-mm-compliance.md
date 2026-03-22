---
"@newyorkcompute/kalshi-mm": minor
"@newyorkcompute/kalshi-core": minor
---

Formal Market Maker Program compliance layer (CFTC Rule 40.6(a))

### Compliance Enforcer
- Wraps strategy output for Covered Products: injects missing bid/ask sides at minimum obligation levels, clamps spread to Schedule II max, generates two-sided obligation quotes when strategy returns empty
- Non-covered products pass through untouched

### Availability Tracker
- Rolling 1-hour window uptime tracker per product (98% target)
- `wouldBreachTarget()` prevents voluntary withdrawal below target

### Audit Logger
- Structured JSONL audit trail for quote decisions, adjustments, fills, self-trade events, availability snapshots, and config changes

### Self-Trade Guard
- Pre-placement check detects when a new quote would cross own resting orders
- Returns cancel-list for the resting side

### Risk Manager Enhancements
- 10x position accountability multiplier for MM-designated covered products (Rule 4.5(a))
- Per-contract dynamic position limit caching from Kalshi API
- Prefix matching consistent with compliance enforcer

### Bot Integration
- Compliance enforcement inserted in quote pipeline after strategy, before drawdown scaling
- Drawdown scaling floors at compliance minSize for covered products
- Compliance status exposed via `getState()` API
