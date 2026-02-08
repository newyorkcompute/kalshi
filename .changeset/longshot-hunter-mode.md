---
"@newyorkcompute/kalshi-mm": minor
---

feat(mm): longshot hunter mode with safety cancellations

- Add `skipMidRange` strategy parameter to skip mid-range quoting entirely, focusing exclusively on high-edge longshot and near-certainty zones per Becker's research
- Add volatility detection config parameters (`volatilityWindow`, `volatilityThresholdCents`) to strategy schema
- Cancel all resting orders when strategy returns no quotes (e.g. volatile mid-range, non-quotable markets)
- Cancel all resting orders when drawdown multiplier hits zero for immediate risk halt
- Add comprehensive tests for skipMidRange behavior across all price zones
