#!/usr/bin/env npx tsx
/**
 * Kalshi API Client
 *
 * A ready-to-use client for interacting with Kalshi prediction markets.
 * Can be executed directly with `npx tsx` or imported as a module.
 *
 * Usage:
 *   # As a script - list open markets
 *   npx tsx kalshi-client.ts markets --limit 10
 *
 *   # As a script - get specific market
 *   npx tsx kalshi-client.ts market PRES-2024-DEM
 *
 *   # As a module
 *   import { KalshiClient } from './kalshi-client';
 *   const client = new KalshiClient();
 *   const markets = await client.getMarkets({ limit: 10 });
 */

import * as crypto from "crypto";

// ==================== Types ====================

export interface KalshiClientConfig {
  apiKey?: string;
  privateKeyPem?: string;
  baseUrl?: string;
  demo?: boolean;
}

export interface Market {
  ticker: string;
  title: string;
  status: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  volume?: number;
  open_interest?: number;
  close_time?: string;
  [key: string]: unknown;
}

export interface Orderbook {
  yes: [number, number][];
  no: [number, number][];
}

export interface Trade {
  trade_id: string;
  ticker: string;
  count: number;
  yes_price: number;
  no_price: number;
  taker_side: string;
  created_time: string;
}

export interface Event {
  event_ticker: string;
  title: string;
  category?: string;
  markets?: string[];
  [key: string]: unknown;
}

export interface Balance {
  balance: number;
  payout: number;
}

export interface Position {
  ticker: string;
  position: number;
  market_exposure: number;
  realized_pnl: number;
  total_traded: number;
  resting_orders_count: number;
}

export interface Order {
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  type: "limit" | "market";
  yes_price?: number;
  no_price?: number;
  count: number;
  remaining_count: number;
  status: string;
  created_time: string;
}

export interface CreateOrderParams {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  price: number;
  type?: "limit" | "market";
}

// ==================== Client ====================

export class KalshiClient {
  private readonly apiKey?: string;
  private readonly privateKeyPem?: string;
  private readonly baseUrl: string;

  static readonly DEFAULT_BASE_URL =
    "https://api.elections.kalshi.com/trade-api/v2";
  static readonly DEMO_BASE_URL = "https://demo-api.kalshi.co/trade-api/v2";

  constructor(config: KalshiClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.KALSHI_API_KEY;
    this.privateKeyPem = config.privateKeyPem ?? process.env.KALSHI_PRIVATE_KEY;

    if (config.demo) {
      this.baseUrl = KalshiClient.DEMO_BASE_URL;
    } else {
      this.baseUrl = config.baseUrl ?? KalshiClient.DEFAULT_BASE_URL;
    }
  }

  private getAuthHeaders(method: string, path: string): Record<string, string> {
    if (!this.apiKey || !this.privateKeyPem) {
      throw new Error(
        "API key and private key required for authenticated requests"
      );
    }

    const timestamp = Date.now().toString();
    const message = `${timestamp}${method}${path}`;

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(message);
    const signature = sign.sign(this.privateKeyPem, "base64");

    return {
      "KALSHI-ACCESS-KEY": this.apiKey,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number>;
      body?: Record<string, unknown>;
      authenticated?: boolean;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.authenticated) {
      Object.assign(headers, this.getAuthHeaders(method, path));
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== Public Endpoints ====================

  async getMarkets(options: {
    limit?: number;
    status?: string;
    cursor?: string;
    eventTicker?: string;
  } = {}): Promise<Market[]> {
    const params: Record<string, string | number> = {
      limit: options.limit ?? 100,
      status: options.status ?? "open",
    };
    if (options.cursor) params.cursor = options.cursor;
    if (options.eventTicker) params.event_ticker = options.eventTicker;

    const result = await this.request<{ markets: Market[] }>("GET", "/markets", {
      params,
    });
    return result.markets ?? [];
  }

  async getMarket(ticker: string): Promise<Market> {
    const result = await this.request<{ market: Market }>(
      "GET",
      `/markets/${ticker}`
    );
    return result.market;
  }

  async getOrderbook(ticker: string, depth?: number): Promise<Orderbook> {
    const params: Record<string, string | number> = {};
    if (depth) params.depth = depth;

    const result = await this.request<{ orderbook: Orderbook }>(
      "GET",
      `/markets/${ticker}/orderbook`,
      { params }
    );
    return result.orderbook;
  }

  async getTrades(
    ticker: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<Trade[]> {
    const params: Record<string, string | number> = {
      limit: options.limit ?? 100,
    };
    if (options.cursor) params.cursor = options.cursor;

    const result = await this.request<{ trades: Trade[] }>(
      "GET",
      `/markets/${ticker}/trades`,
      { params }
    );
    return result.trades ?? [];
  }

  async getEvents(options: {
    limit?: number;
    status?: string;
    cursor?: string;
  } = {}): Promise<Event[]> {
    const params: Record<string, string | number> = {
      limit: options.limit ?? 100,
      status: options.status ?? "open",
    };
    if (options.cursor) params.cursor = options.cursor;

    const result = await this.request<{ events: Event[] }>("GET", "/events", {
      params,
    });
    return result.events ?? [];
  }

  async getEvent(eventTicker: string): Promise<Event> {
    const result = await this.request<{ event: Event }>(
      "GET",
      `/events/${eventTicker}`
    );
    return result.event;
  }

  // ==================== Authenticated Endpoints ====================

  async getBalance(): Promise<Balance> {
    return this.request<Balance>("GET", "/portfolio/balance", {
      authenticated: true,
    });
  }

  async getPositions(options: {
    ticker?: string;
    settlementStatus?: string;
  } = {}): Promise<Position[]> {
    const params: Record<string, string | number> = {
      settlement_status: options.settlementStatus ?? "unsettled",
    };
    if (options.ticker) params.ticker = options.ticker;

    const result = await this.request<{ market_positions: Position[] }>(
      "GET",
      "/portfolio/positions",
      { params, authenticated: true }
    );
    return result.market_positions ?? [];
  }

  async getOrders(options: {
    ticker?: string;
    status?: string;
  } = {}): Promise<Order[]> {
    const params: Record<string, string | number> = {
      status: options.status ?? "resting",
    };
    if (options.ticker) params.ticker = options.ticker;

    const result = await this.request<{ orders: Order[] }>(
      "GET",
      "/portfolio/orders",
      { params, authenticated: true }
    );
    return result.orders ?? [];
  }

  async createOrder(params: CreateOrderParams): Promise<Order> {
    const body: Record<string, unknown> = {
      ticker: params.ticker,
      side: params.side,
      action: params.action,
      type: params.type ?? "limit",
      count: params.count,
    };

    if (body.type === "limit") {
      if (params.side === "yes") {
        body.yes_price = params.price;
      } else {
        body.no_price = params.price;
      }
    }

    const result = await this.request<{ order: Order }>(
      "POST",
      "/portfolio/orders",
      { body, authenticated: true }
    );
    return result.order;
  }

  async cancelOrder(orderId: string): Promise<Order> {
    const result = await this.request<{ order: Order }>(
      "DELETE",
      `/portfolio/orders/${orderId}`,
      { authenticated: true }
    );
    return result.order;
  }
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Kalshi API Client

Usage:
  npx tsx kalshi-client.ts <command> [options]

Commands:
  markets [--limit N] [--status open|closed]  List markets
  market <ticker>                             Get market details
  orderbook <ticker>                          Get orderbook
  balance                                     Get account balance (requires auth)
  positions                                   Get positions (requires auth)
    `);
    return;
  }

  const client = new KalshiClient();

  switch (command) {
    case "markets": {
      const limitIdx = args.indexOf("--limit");
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 10;
      const statusIdx = args.indexOf("--status");
      const status = statusIdx !== -1 ? args[statusIdx + 1] : "open";

      const markets = await client.getMarkets({ limit, status });
      for (const market of markets) {
        console.log(`${market.ticker}: ${market.title}`);
        console.log(
          `  Yes: ${market.yes_bid ?? "N/A"}¢ - ${market.yes_ask ?? "N/A"}¢`
        );
        console.log();
      }
      break;
    }

    case "market": {
      const ticker = args[1];
      if (!ticker) {
        console.error("Usage: market <ticker>");
        process.exit(1);
      }
      const market = await client.getMarket(ticker);
      console.log(JSON.stringify(market, null, 2));
      break;
    }

    case "orderbook": {
      const ticker = args[1];
      if (!ticker) {
        console.error("Usage: orderbook <ticker>");
        process.exit(1);
      }
      const orderbook = await client.getOrderbook(ticker);
      console.log(JSON.stringify(orderbook, null, 2));
      break;
    }

    case "balance": {
      const balance = await client.getBalance();
      console.log(`Balance: $${(balance.balance / 100).toFixed(2)}`);
      break;
    }

    case "positions": {
      const positions = await client.getPositions();
      for (const pos of positions) {
        console.log(`${pos.ticker}: ${pos.position} contracts`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run CLI if executed directly
main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});

