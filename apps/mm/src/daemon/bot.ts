/**
 * Market Maker Bot
 *
 * The core daemon that connects to Kalshi and manages the quoting loop.
 */

import {
  OrderManager,
  InventoryTracker,
  RiskManager,
  KalshiWsClient,
  createOrdersApi,
  createMarketApi,
  createPortfolioApi,
  type RiskLimits,
  type PnLSummary,
} from "@newyorkcompute/kalshi-core";
import type { MarketApi, PortfolioApi } from "kalshi-typescript";

/** Ticker data from WebSocket (inner msg) */
interface TickerData {
  market_ticker: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
}

/** Fill data from WebSocket (inner msg) */
interface FillData {
  trade_id: string;
  order_id: string;
  market_ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  price: number;
  created_time: string;
}

import type { Config } from "../config.js";
import { getKalshiCredentials, getBasePath } from "../config.js";
import { createStrategy, type Strategy, type MarketSnapshot } from "../strategies/index.js";

export interface BotState {
  running: boolean;
  paused: boolean;
  connected: boolean;
  markets: string[];
  activeOrders: number;
  positions: ReturnType<InventoryTracker["getAllPositions"]>;
  pnl: PnLSummary;
  risk: ReturnType<RiskManager["getStatus"]>;
}

/**
 * Market Maker Bot
 */
export class Bot {
  private running = false;
  private paused = false;

  private config: Config;
  private credentials: { apiKey: string; privateKey: string };
  private basePath: string;

  // API clients
  private ordersApi: ReturnType<typeof createOrdersApi> | null = null;
  private marketApi: MarketApi | null = null;
  private portfolioApi: PortfolioApi | null = null;

  // Core components
  private ws: KalshiWsClient | null = null;
  private orderManager: OrderManager | null = null;
  private inventory: InventoryTracker;
  private risk: RiskManager;
  private strategy: Strategy;

  // Market state
  private marketData: Map<string, { bestBid: number; bestAsk: number }> =
    new Map();

  constructor(config: Config) {
    this.config = config;
    this.credentials = getKalshiCredentials();
    this.basePath = getBasePath(config.kalshi.demo);

    // Initialize components
    this.inventory = new InventoryTracker();
    this.risk = new RiskManager(config.risk as RiskLimits);
    this.strategy = createStrategy(config.strategy);

    console.log(`[Bot] Strategy: ${this.strategy.name}`);
    console.log(`[Bot] Mode: ${config.kalshi.demo ? "DEMO" : "PRODUCTION"}`);
    console.log(`[Bot] Markets: ${config.markets.join(", ")}`);
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[Bot] Already running");
      return;
    }

    console.log("[Bot] Starting...");
    this.running = true;

    try {
      // Initialize API clients
      const apiConfig = {
        apiKey: this.credentials.apiKey,
        privateKey: this.credentials.privateKey,
        basePath: this.basePath,
      };

      this.ordersApi = createOrdersApi(apiConfig);
      this.marketApi = createMarketApi(apiConfig);
      this.portfolioApi = createPortfolioApi(apiConfig);
      this.orderManager = new OrderManager(this.ordersApi);

      // Initialize WebSocket
      this.ws = new KalshiWsClient({
        apiKeyId: this.credentials.apiKey,
        privateKey: this.credentials.privateKey,
        demo: this.config.kalshi.demo,
        autoReconnect: true,
        reconnectDelay: this.config.daemon.reconnectDelayMs,
      });

      // Set up event handlers
      this.ws.on("onTicker", (data) => this.onTicker(data as TickerData));
      this.ws.on("onFill", (data) => this.onFill(data as FillData));
      this.ws.on("onConnect", () => this.onConnect());
      this.ws.on("onDisconnect", () => this.onDisconnect());
      this.ws.on("onError", (err) => this.onError(err));

      // Connect
      await this.ws.connect();

      console.log("[Bot] Started successfully");

      // Keep alive (the bot runs via WebSocket events)
      while (this.running) {
        await this.sleep(1000);

        // Periodic cleanup
        if (this.orderManager) {
          this.orderManager.cleanup();
        }
      }
    } catch (error) {
      console.error("[Bot] Failed to start:", error);
      this.running = false;
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.running) {
      console.log("[Bot] Not running");
      return;
    }

    console.log("[Bot] Stopping...");
    this.running = false;

    // Cancel all orders
    if (this.orderManager) {
      const cancelled = await this.orderManager.cancelAll();
      console.log(`[Bot] Cancelled ${cancelled} orders`);
    }

    // Disconnect WebSocket
    if (this.ws) {
      this.ws.disconnect();
    }

    console.log("[Bot] Stopped");
  }

  /**
   * Pause quoting (keep positions)
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    console.log("[Bot] Paused");
  }

  /**
   * Resume quoting
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    console.log("[Bot] Resumed");
  }

  /**
   * Flatten all positions (cancel orders)
   */
  async flatten(): Promise<void> {
    console.log("[Bot] Flattening...");
    if (this.orderManager) {
      const cancelled = await this.orderManager.cancelAll();
      console.log(`[Bot] Cancelled ${cancelled} orders`);
    }
  }

  /**
   * Get current bot state
   */
  getState(): BotState {
    return {
      running: this.running,
      paused: this.paused,
      connected: this.ws?.isConnected ?? false,
      markets: this.config.markets,
      activeOrders: this.orderManager?.getActive().length ?? 0,
      positions: this.inventory.getAllPositions(),
      pnl: this.inventory.getPnLSummary(),
      risk: this.risk.getStatus(this.inventory),
    };
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): Record<string, number | string | boolean> {
    const state = this.getState();
    return {
      running: state.running,
      paused: state.paused,
      connected: state.connected,
      activeOrders: state.activeOrders,
      totalExposure: state.risk.totalExposure,
      dailyPnL: state.pnl.realizedToday,
      fillsToday: state.pnl.fillsToday,
      volumeToday: state.pnl.volumeToday,
      halted: state.risk.halted,
    };
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running && !this.paused;
  }

  // ========== Private Methods ==========

  private async onConnect(): Promise<void> {
    console.log("[Bot] WebSocket connected");

    // Subscribe to ticker channel for our markets + fill channel for our orders
    if (this.ws) {
      this.ws.subscribe(["ticker"], this.config.markets);
      this.ws.subscribe(["fill"]); // Authenticated channel for our fills
      console.log(`[Bot] Subscribed to ${this.config.markets.length} markets`);
    }
  }

  private onDisconnect(): void {
    console.log("[Bot] WebSocket disconnected");
  }

  private onError(error: Error): void {
    console.error("[Bot] WebSocket error:", error.message);
  }

  private async onTicker(data: TickerData): Promise<void> {
    const ticker = data.market_ticker;

    // Skip if not in our market list
    if (!this.config.markets.includes(ticker)) return;

    // Skip if paused or halted
    if (this.paused || this.risk.shouldHalt()) return;

    // Update market data
    this.marketData.set(ticker, {
      bestBid: data.yes_bid ?? 0,
      bestAsk: data.yes_ask ?? 0,
    });

    // Generate and place quotes
    await this.updateQuotes(ticker);
  }

  private async onFill(data: FillData): Promise<void> {
    console.log(
      `[Bot] Fill: ${data.action} ${data.count}x ${data.market_ticker} @ ${data.price}¢`
    );

    // Update inventory
    this.inventory.onFill({
      orderId: data.order_id,
      ticker: data.market_ticker,
      side: data.side,
      action: data.action,
      count: data.count,
      price: data.price,
      timestamp: new Date(),
    });

    // Notify strategy
    this.strategy.onFill({
      orderId: data.order_id,
      ticker: data.market_ticker,
      side: data.side,
      action: data.action,
      count: data.count,
      price: data.price,
      timestamp: new Date(),
    });

    // Update risk (simplified PnL tracking)
    // In production, would calculate actual realized PnL
    this.risk.onFill(
      {
        orderId: data.order_id,
        ticker: data.market_ticker,
        side: data.side,
        action: data.action,
        count: data.count,
        price: data.price,
        timestamp: new Date(),
      },
      0 // Placeholder - would calculate real PnL
    );
  }

  private async updateQuotes(ticker: string): Promise<void> {
    if (!this.orderManager) return;

    const data = this.marketData.get(ticker);
    if (!data) return;

    // Build market snapshot
    const position = this.inventory.getPosition(ticker) ?? null;
    const mid = (data.bestBid + data.bestAsk) / 2;

    const snapshot: MarketSnapshot = {
      ticker,
      bestBid: data.bestBid,
      bestAsk: data.bestAsk,
      mid,
      spread: data.bestAsk - data.bestBid,
      position,
    };

    // Get quotes from strategy
    const quotes = this.strategy.computeQuotes(snapshot);

    // Place quotes (risk check happens inside updateQuote)
    for (const quote of quotes) {
      const check = this.risk.checkQuote(quote, this.inventory);
      if (!check.allowed) {
        console.log(`[Bot] Quote rejected: ${check.reason}`);
        continue;
      }

      try {
        await this.orderManager.updateQuote(quote);
      } catch (error) {
        console.error(`[Bot] Failed to update quote for ${ticker}:`, error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

