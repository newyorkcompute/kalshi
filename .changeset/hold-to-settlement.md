---
"@newyorkcompute/kalshi-mm": patch
---

Fix round-trip churning by adding hold-to-settlement logic to the optimism-tax strategy. Once a position is opened in the zone's intended direction, the closing side is suppressed to prevent adverse selection losses from rapid open/close cycles.
