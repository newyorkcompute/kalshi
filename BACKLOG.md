# Monorepo Backlog

> Comprehensive list of improvements, features, and technical debt for the @newyorkcompute/kalshi monorepo.
> 
> Last updated: December 28, 2025

## Legend

- ⬜ Not started
- 🟡 In progress
- ✅ Done
- ❌ Won't do


## kalshi-core Features

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ✅ | High | WebSocket support | Real-time price updates, orderbook streaming |
| ⬜ | Medium | Market search helpers | Filter by category, series, keyword, volume |
| ✅ | Medium | Position P&L calculator | Calculate unrealized P&L from positions |
| ⬜ | Low | Order builder pattern | Fluent API: `Order.buy('YES').at(50).quantity(10)` |
| ✅ | Low | Retry logic wrapper | Automatic retry with backoff for API calls |

---

## kalshi-tui Features

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | High | Trading (buy/sell) | Place orders from TUI |
| ⬜ | High | Market search/filter | Type to filter markets by name/ticker |
| ⬜ | High | Resting orders panel | Show pending limit orders |
| ⬜ | Medium | Keyboard shortcuts help | Press `?` to show all shortcuts |
| ⬜ | Medium | Watchlist/favorites | Save favorite markets locally |
| ⬜ | Medium | Event grouping | Group related markets together |
| ⬜ | Medium | Config file | `~/.kalshi-tui/config.json` for preferences |
| ⬜ | Low | Notifications/alerts | Alert on price thresholds |
| ⬜ | Low | Position P&L display | Show profit/loss on positions |
| ✅ | Low | Sort toggle | Press `s` to cycle sort: volume → 24h → OI |

---

## kalshi-mcp Features

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ✅ | Medium | Batch operations | batch_cancel_orders, get_fills, get_settlements |
| ⬜ | Medium | Trade confirmation | Require explicit confirmation for orders |
| ⬜ | Low | Market recommendations | "Interesting markets" based on volume, spread |
| ✅ | Low | Account history | get_fills, get_settlements tools |
| ⬜ | Low | Portfolio analytics | Summary stats, best/worst performers |

---

## Technical Debt

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | Medium | Skills folder structure | Unclear how it fits in monorepo, not a package |
| ⬜ | Low | Duplicate `kalshi-typescript` | Listed in both core and tui dependencies |
| ⬜ | Low | Test files in dist | `.test.ts` files being compiled to dist |
| ⬜ | Low | Audit `.gitignore` | May be missing patterns |
| ⬜ | Low | Clean up stale docs | TODO.md, TUI_ROADMAP.md, SID_TODO.md |

---

## Completed

| Date | Item | PR |
|------|------|----|
| 2025-12-28 | TUI sort toggle (s key) | #63 |
| 2025-12-28 | Remove Smithery references | #62 |
| 2025-12-28 | Upgrade to Node 22 LTS | #61 |
| 2025-12-28 | MCP tools: get_fills, batch_cancel_orders, get_settlements | #59 |
| 2025-12-28 | Market maker daemon with adaptive strategy | #57 |
| 2025-12-27 | WebSocket support for real-time data | #53 |
| 2025-12-27 | Arbitrage scanner in TUI | #51 |
| 2025-12-27 | Dependency audit | #49 |
| 2025-12-27 | JSDoc documentation | #47 |
| 2025-12-27 | NX affected + CI caching | #45 |
| 2025-12-27 | Test coverage boost + TUI snapshot tests | #44 |
| 2025-12-27 | Codecov integration | #43 |
| 2025-12-26 | Enhanced orderbook (mid price, depth, imbalance) | #35 |
| 2025-12-26 | Market metrics (24h volume, open interest) | #37 |
| 2025-12-26 | Core utilities (cache, rate limiter, formatExpiry) | #39 |
| 2025-12-26 | Price charts with asciichart | #34 |
| 2025-12-26 | Stability fixes (rate limiting, circuit breaker) | #34 |
| 2025-12-26 | Changeset CI check | #32 |
| 2025-12-26 | TUI quick wins (price change indicators, volume) | #29 |
| 2025-12-26 | Ink-based TUI rewrite | #28 |

---

## Notes

- Priorities are subjective: High = high impact/low effort, Low = nice-to-have
- Update status as items progress
- Add new items to appropriate sections
- Move completed items to the Completed table with PR reference

