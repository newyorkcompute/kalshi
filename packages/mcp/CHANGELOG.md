# @newyorkcompute/kalshi-mcp

## 0.5.0

### Minor Changes

- [#59](https://github.com/newyorkcompute/kalshi/pull/59) [`1f2c7b4`](https://github.com/newyorkcompute/kalshi/commit/1f2c7b46c83cbb0af8be66278099ed5b0b60af84) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add new MCP tools for fills, batch cancel, and settlements

  - **get_fills**: Get your fill (executed trade) history with filtering by ticker, order ID, and timestamps
  - **batch_cancel_orders**: Cancel up to 20 orders at once in a single request
  - **get_settlements**: Get your settlement history with market outcomes and payout details

## 0.4.0

### Minor Changes

- [#25](https://github.com/newyorkcompute/kalshi/pull/25) [`8fb6abb`](https://github.com/newyorkcompute/kalshi/commit/8fb6abb3b735ca59ef28a2b03940414fa33f3276) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Refactor to use shared @newyorkcompute/kalshi-core package for API configuration and utilities

## 0.3.0

### Minor Changes

- [#3](https://github.com/newyorkcompute/kalshi/pull/3) [`d260c98`](https://github.com/newyorkcompute/kalshi/commit/d260c9802270bac3458e2e8d1b0774c86787c02a) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Add P1 tools for portfolio management, events, trades, and order operations

  **Portfolio tools:**

  - `get_balance` - Get account balance and portfolio value
  - `get_positions` - Get current positions on markets

  **Event tools:**

  - `get_events` - List events with filters
  - `get_event` - Get detailed event information

  **Trade tools:**

  - `get_trades` - Get recent trades on markets

  **Order tools:**

  - `get_orders` - List your orders with filters
  - `create_order` - Place a new order (buy/sell yes/no)
  - `cancel_order` - Cancel a resting order

## 0.2.0

### Minor Changes

- [#1](https://github.com/newyorkcompute/kalshi/pull/1) [`9ccf21a`](https://github.com/newyorkcompute/kalshi/commit/9ccf21aca0de841b4cb9fe9fd07692200e9a0e7b) Thanks [@siddharthkul](https://github.com/siddharthkul)! - Initial release of Kalshi MCP server

  - `get_markets` - List and search Kalshi prediction markets
  - `get_market` - Get detailed market information by ticker
  - `get_orderbook` - Get orderbook for a market
