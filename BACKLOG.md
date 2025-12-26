# Monorepo Backlog

> Comprehensive list of improvements, features, and technical debt for the @newyorkcompute/kalshi monorepo.
> 
> Last updated: December 26, 2025

## Legend

- ⬜ Not started
- 🟡 In progress
- ✅ Done
- ❌ Won't do

---

## Repo Admin

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | High | Branch protection rules | Require CI pass, reviews before merge to main |
| ⬜ | Medium | `.nvmrc` / `.node-version` | Pin Node version (20) for contributors |
| ⬜ | Medium | Tune Dependabot | Configure update schedule, ignore patterns |
| ⬜ | Medium | GitHub Releases | Auto-create releases with changelogs on npm publish |
| ⬜ | Low | CODEOWNERS | Auto-assign reviewers by path |
| ⬜ | Low | npm provenance | Supply chain security for published packages |

---

## Developer Experience

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | Medium | Pre-commit hooks | Husky + lint-staged for auto-lint/format |
| ⬜ | Low | Prettier | Consistent code formatting across packages |
| ⬜ | Low | `npm run dev` at root | Watch mode for all packages |
| ⬜ | Low | VSCode workspace settings | `.vscode/settings.json` for team consistency |
| ⬜ | Low | Docker support | Dockerfile for MCP server deployment |

---

## Testing

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | Medium | Code coverage reports | Track coverage in CI, upload to Codecov/Coveralls |
| ⬜ | Low | Coverage thresholds | Enforce minimum coverage (e.g., 80%) |
| ⬜ | Low | E2E tests | Integration tests against Kalshi demo API |
| ⬜ | Low | TUI snapshot tests | Catch UI regressions with ink-testing-library |

---

## CI/CD

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | High | Use `nx affected` | Only run tasks on changed packages (faster CI) |
| ⬜ | Medium | Cache npm dependencies | Speed up CI with `actions/cache` |
| ⬜ | Low | Matrix builds | Test on Node 18, 20, 22 |
| ⬜ | Low | Publish dry-run on PR | Verify packages are publishable before merge |

---

## kalshi-core Features

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | High | WebSocket support | Real-time price updates, orderbook streaming |
| ⬜ | Medium | Market search helpers | Filter by category, series, keyword, volume |
| ⬜ | Medium | Position P&L calculator | Calculate unrealized P&L from positions |
| ⬜ | Low | Order builder pattern | Fluent API: `Order.buy('YES').at(50).quantity(10)` |
| ⬜ | Low | Retry logic wrapper | Automatic retry with backoff for API calls |

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
| ⬜ | Low | Sort toggle | Press `s` to cycle sort: volume → 24h → OI |

---

## kalshi-mcp Features

| Status | Priority | Item | Description |
|--------|----------|------|-------------|
| ⬜ | Medium | Batch operations | Get multiple markets/events in one call |
| ⬜ | Medium | Trade confirmation | Require explicit confirmation for orders |
| ⬜ | Low | Market recommendations | "Interesting markets" based on volume, spread |
| ⬜ | Low | Account history | Recent trades, deposits, withdrawals |
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

