# @newyorkcompute/kalshi-weather

## 0.2.0

### Minor Changes

- [#114](https://github.com/newyorkcompute/kalshi/pull/114) [`0049b5d`](https://github.com/newyorkcompute/kalshi/commit/0049b5de1519794a0112a034ce3ae43c098859cd) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Observation-aware fair values and faster refresh support

  - Add NWS station observation fetching for same-day running max/min extremes
  - Add observation-conditioned probability helpers and fair-value integration
  - Export `isSameDayMarket` and observation-aware probability functions
  - Default forecast refresh interval reduced from 30 to 10 minutes (configurable)
