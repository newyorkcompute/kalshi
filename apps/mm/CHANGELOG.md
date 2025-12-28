# @newyorkcompute/kalshi-mm

## 0.2.0

### Minor Changes

- [#72](https://github.com/newyorkcompute/kalshi/pull/72) [`b3b9454`](https://github.com/newyorkcompute/kalshi/commit/b3b9454efcd28bfdc8389512b2aa7eb3d18388fe) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Phase 2 Elite MM: Microprice, Multi-Level Quoting, Adverse Selection

  ## Microprice Fair Value

  - Use size-weighted mid (microprice) as fair value instead of simple mid
  - Better estimates where the "true" price is based on orderbook depth
  - Enable/disable via `useMicroprice` config option

  ## Multi-Level Quoting

  - Quote at multiple price levels for better inventory management
  - Level 1: Tight spread (1¢ inside), small size - captures spread
  - Level 2: At market, larger size - inventory management
  - Enable via `multiLevel: true` config option

  ## Adverse Selection Detection

  - Track consecutive fills in same direction
  - Monitor price moves after fills to detect informed flow
  - Automatically widen spreads when being picked off
  - Configurable cooldown and thresholds
  - New `/metrics` fields: `adverseFlagged`, `adverseMarkets`

  ## Tests

  - 21 new tests for adaptive strategy and adverse selection
  - Total: 44 MM tests passing
