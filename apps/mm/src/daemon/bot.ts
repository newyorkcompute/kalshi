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
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

  // Logging
  private logFile: string;
  private lastSummaryTime: number = 0;
  private readonly SUMMARY_INTERVAL_MS = 60000; // Log summary every minute

  constructor(config: Config) {
    // Set up log file
    const logsDir = join(process.cwd(), "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    const date = new Date().toISOString().split("T")[0];
    this.logFile = join(logsDir, `mm-${date}.log`);

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
    console.log(`[Bot] Log file: ${this.logFile}`);

    // Log startup
    this.logToFile(`=== BOT STARTED ===`);
    this.logToFile(`Strategy: ${this.strategy.name}`);
    this.logToFile(`Mode: ${config.kalshi.demo ? "DEMO" : "PRODUCTION"}`);
    this.logToFile(`Markets: ${config.markets.join(", ")}`);
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

      // Sync existing positions from Kalshi
      await this.syncPositions();

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
      this.ws.on("onOrderbookSnapshot", (data) => this.onOrderbookSnapshot(data));
      this.ws.on("onOrderbookDelta", (data) => this.onOrderbookDelta(data));
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

        // Periodic summary
        this.maybePrintSummary();
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

    // Subscribe to ticker + orderbook_delta for our markets, plus fill channel
    if (this.ws) {
      this.ws.subscribe(["ticker", "orderbook_delta"], this.config.markets);
      this.ws.subscribe(["fill"]); // Authenticated channel for our fills
      console.log(`[Bot] Subscribed to: ${this.config.markets.join(", ")}`);
      console.log("[Bot] Waiting for market data...");
    }
  }

  private onDisconnect(): void {
    console.log("[Bot] WebSocket disconnected");
  }

  /**
   * Sync positions from Kalshi API on startup
   */
  private async syncPositions(): Promise<void> {
    if (!this.portfolioApi) return;

    console.log("[Bot] Syncing positions from Kalshi...");

    try {
      const response = await this.portfolioApi.getPositions(
        undefined, // cursor
        100,       // limit
        "position" // countFilter - only get positions with non-zero position
      );

      const positions = response.data?.market_positions ?? [];

      if (positions.length === 0) {
        console.log("[Bot] No existing positions");
        this.logToFile("Position sync: No existing positions");
        return;
      }

      // Filter to only our configured markets
      const relevantPositions = positions.filter(p =>
        this.config.markets.includes(p.ticker)
      );

      // Initialize inventory with existing positions
      const portfolioData = relevantPositions.map(p => ({
        ticker: p.ticker,
        yesContracts: p.position > 0 ? Math.abs(p.position) : 0,
        noContracts: p.position < 0 ? Math.abs(p.position) : 0,
        costBasis: Math.abs(p.market_exposure), // Use exposure as approximate cost
      }));

      this.inventory.initializeFromPortfolio(portfolioData);

      // Log synced positions
      console.log(`[Bot] ✅ Synced ${relevantPositions.length} positions:`);
      for (const p of relevantPositions) {
        const pos = p.position;
        const side = pos > 0 ? "YES" : "NO";
        const exposure = (p.market_exposure / 100).toFixed(2);
        console.log(`   ${p.ticker}: ${Math.abs(pos)} ${side} ($${exposure} exposure)`);
        this.logToFile(`Position sync: ${p.ticker} ${Math.abs(pos)} ${side}`);
      }

      // Also log any positions in OTHER markets (warning)
      const otherPositions = positions.filter(p =>
        !this.config.markets.includes(p.ticker) && p.position !== 0
      );
      if (otherPositions.length > 0) {
        console.log(`[Bot] ⚠️ You have ${otherPositions.length} positions in OTHER markets (not managed by this bot)`);
      }

    } catch (error) {
      console.error("[Bot] ⚠️ Failed to sync positions:", error);
      this.logToFile(`Position sync failed: ${error}`);
      // Continue anyway - will track from fills going forward
    }
  }

  private onError(error: Error): void {
    console.error("[Bot] WebSocket error:", error.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async onOrderbookSnapshot(data: any): Promise<void> {
    const ticker = data.market_ticker;
    if (!ticker || !this.config.markets.includes(ticker)) return;

    // Extract best bid/ask from full orderbook
    // yes array: [[price, quantity], ...] - these are YES bids
    // no array: [[price, quantity], ...] - these are NO bids (YES asks = 100 - NO bid)
    const yesBids: [number, number][] = data.yes || [];
    const noBids: [number, number][] = data.no || [];

    // Best YES bid = highest price in yes array with quantity > 0
    const activeBids = yesBids.filter((p) => p[1] > 0);
    const bestBid = activeBids.length > 0 ? Math.max(...activeBids.map((p) => p[0])) : 0;

    // Best YES ask = 100 - highest NO bid (since NO bid of 90¢ = YES ask of 10¢)
    const activeNoBids = noBids.filter((p) => p[1] > 0);
    const bestNoPrice = activeNoBids.length > 0 ? Math.max(...activeNoBids.map((p) => p[0])) : 0;
    const bestAsk = bestNoPrice > 0 ? 100 - bestNoPrice : 100;

    console.log(`[Bot] Market: ${ticker} ${bestBid}¢/${bestAsk}¢ (spread ${bestAsk - bestBid}¢)`);

    if (this.paused || this.risk.shouldHalt()) return;

    // Update market data
    this.marketData.set(ticker, { bestBid, bestAsk });

    // Generate and place quotes
    await this.updateQuotes(ticker);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async onOrderbookDelta(_data: any): Promise<void> {
    // Delta updates are incremental - we rely on ticker updates for bid/ask
    // In production, we'd maintain local orderbook state from deltas
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
    const fill = {
      orderId: data.order_id,
      ticker: data.market_ticker,
      side: data.side,
      action: data.action,
      count: data.count,
      price: data.price,
      timestamp: new Date(),
    };

    // Get P&L BEFORE fill for comparison
    const pnlBefore = this.inventory.getPnLSummary();

    // Update inventory
    this.inventory.onFill(fill);

    // Get position AFTER fill
    const positionAfter = this.inventory.getPosition(data.market_ticker);
    const pnlAfter = this.inventory.getPnLSummary();

    // Calculate realized P&L from this fill
    const realizedFromFill = pnlAfter.realizedToday - pnlBefore.realizedToday;

    // Format fill log with emoji and details
    const emoji = data.action === "buy" ? "🟢" : "🔴";
    const cost = data.count * data.price;
    const netPos = positionAfter?.netExposure ?? 0;
    const posDir = netPos > 0 ? "LONG" : netPos < 0 ? "SHORT" : "FLAT";

    console.log(
      `\n${emoji} FILL: ${data.action.toUpperCase()} ${data.count}x ${data.side.toUpperCase()} @ ${data.price}¢`
    );
    console.log(`   Market: ${data.market_ticker}`);
    console.log(`   Cost: ${cost}¢ ($${(cost / 100).toFixed(2)})`);
    console.log(`   Position: ${Math.abs(netPos)} contracts ${posDir}`);

    if (realizedFromFill !== 0) {
      const pnlEmoji = realizedFromFill > 0 ? "💰" : "💸";
      console.log(`   ${pnlEmoji} Realized P&L: ${realizedFromFill > 0 ? "+" : ""}${realizedFromFill}¢ ($${(realizedFromFill / 100).toFixed(2)})`);
    }

    console.log(`   📊 Session: ${pnlAfter.fillsToday} fills, ${pnlAfter.volumeToday} contracts, P&L: ${pnlAfter.realizedToday > 0 ? "+" : ""}${pnlAfter.realizedToday}¢\n`);

    // Log to file
    this.logFillToFile(data, realizedFromFill, pnlAfter.realizedToday);

    // Notify strategy
    this.strategy.onFill(fill);

    // Update risk with realized P&L
    this.risk.onFill(fill, realizedFromFill);
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
        console.log(`[Bot] ⚠️ Quote rejected: ${check.reason}`);
        continue;
      }

      try {
        await this.orderManager.updateQuote(quote);
        console.log(`[Bot] 📝 Quote: ${quote.ticker} ${quote.bidSize}x@${quote.bidPrice}¢ / ${quote.askSize}x@${quote.askPrice}¢`);
      } catch (error) {
        console.error(`[Bot] ❌ Quote failed for ${ticker}:`, error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log message to file with timestamp
   */
  private logToFile(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
      appendFileSync(this.logFile, line);
    } catch {
      // Ignore file write errors
    }
  }

  /**
   * Log a fill to file
   */
  private logFillToFile(data: FillData, realizedPnL: number, sessionPnL: number): void {
    const msg = `FILL: ${data.action} ${data.count}x ${data.side} ${data.market_ticker} @ ${data.price}¢ | Realized: ${realizedPnL}¢ | Session P&L: ${sessionPnL}¢`;
    this.logToFile(msg);
  }

  /**
   * Print periodic summary
   */
  private maybePrintSummary(): void {
    const now = Date.now();
    if (now - this.lastSummaryTime < this.SUMMARY_INTERVAL_MS) return;
    this.lastSummaryTime = now;

    const pnl = this.inventory.getPnLSummary();
    const positions = this.inventory.getAllPositions();

    if (pnl.fillsToday === 0 && positions.length === 0) return;

    console.log("\n📈 ─── SESSION SUMMARY ───────────────────────────");
    console.log(`   Fills: ${pnl.fillsToday} | Volume: ${pnl.volumeToday} contracts`);
    console.log(`   Realized P&L: ${pnl.realizedToday > 0 ? "+" : ""}${pnl.realizedToday}¢ ($${(pnl.realizedToday / 100).toFixed(2)})`);

    if (positions.length > 0) {
      console.log("   Positions:");
      for (const pos of positions) {
        if (pos.netExposure !== 0) {
          const dir = pos.netExposure > 0 ? "LONG" : "SHORT";
          console.log(`     ${pos.ticker}: ${Math.abs(pos.netExposure)} ${dir}`);
        }
      }
    }
    console.log("────────────────────────────────────────────────\n");

    // Log to file
    this.logToFile(`SUMMARY: Fills=${pnl.fillsToday} Vol=${pnl.volumeToday} P&L=${pnl.realizedToday}¢`);
  }
}

