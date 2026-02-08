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
  OrderbookManager,
  type RiskLimits,
  type PnLSummary,
  type OrderbookSnapshot,
  type OrderbookDelta,
} from "@newyorkcompute/kalshi-core";
import type { MarketApi, PortfolioApi, Market } from "kalshi-typescript";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/** Log with tag prefix (timestamp is auto-prepended by patched console) */
function log(tag: string, message: string): void {
  console.log(`[${tag}] ${message}`);
}

/** Cached market metadata (including expiry times) */
interface MarketMetadata {
  ticker: string;
  closeTime: Date | null;
  expirationTime: Date | null;
  status: string;
  lastFetched: number;
}

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
  trade_id?: string;
  fill_id?: string;
  order_id: string;
  market_ticker: string;
  ticker?: string;  // Alternative field name
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  yes_price: number;
  no_price: number;
  created_time: string;
  is_taker?: boolean;
}

import type { Config } from "../config.js";
import { getKalshiCredentials, getBasePath } from "../config.js";
import { createStrategy, type Strategy, type MarketSnapshot } from "../strategies/index.js";
import { AdverseSelectionDetector, type FillRecord } from "../adverse-selection.js";
import { DrawdownManager, CircuitBreaker } from "../risk-controls.js";
import { MarketScanner, formatScanResults, type ScanResult, type ScannerConfig } from "../scanner/index.js";

export interface BotState {
  running: boolean;
  paused: boolean;
  connected: boolean;
  markets: string[];
  activeOrders: number;
  positions: ReturnType<InventoryTracker["getAllPositions"]>;
  pnl: PnLSummary;
  risk: ReturnType<RiskManager["getStatus"]>;
  drawdown: ReturnType<DrawdownManager["getStatus"]>;
  circuitBreaker: ReturnType<CircuitBreaker["getStatus"]>;
  connectionHealth: {
    /** WS connection state */
    wsState: string;
    /** Seconds since last data message, or null if no data yet */
    lastDataAgeSec: number | null;
    /** Seconds we've been disconnected, or null if connected */
    disconnectedForSec: number | null;
    /** Total reconnect attempts since last successful connection */
    reconnectAttempts: number;
  };
  scanner?: {
    enabled: boolean;
    lastScan: Date | null;
    marketsFound: number;
  };
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
  private orderbookManager: OrderbookManager;
  private adverseDetector: AdverseSelectionDetector;
  
  // Advanced risk controls
  private drawdownManager: DrawdownManager;
  private circuitBreaker: CircuitBreaker;

  // Scanner for dynamic market selection
  private scanner: MarketScanner | null = null;
  private scannerEnabled: boolean = false;
  private lastScanResult: ScanResult | null = null;

  // Dynamic market list (scanner can modify this)
  private activeMarkets: Set<string> = new Set();

  // Manually-added (pinned) markets — scanner will never remove these
  private pinnedMarkets: Set<string> = new Set();

  // Per-market P&L tracking (for dropping underperformers)
  private marketPnL: Map<string, { realized: number; fills: number; addedAt: number }> = new Map();

  // Market state (legacy - kept for ticker fallback)
  private marketData: Map<string, { bestBid: number; bestAsk: number }> =
    new Map();

  // Latency tracking
  private quoteLatencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 100;

  // Quote debouncing - prevent excessive API calls
  private lastQuoteUpdate: Map<string, number> = new Map();
  private lastBBO: Map<string, { bid: number; ask: number }> = new Map();
  private readonly MIN_QUOTE_INTERVAL_MS = 1000; // Don't update more than 1x/sec per market
  private readonly MIN_PRICE_CHANGE = 1; // Only update if price moves 1¢+
  
  // Global rate limiter - prevents burst of API calls across all markets
  private lastGlobalApiCall: number = 0;
  private readonly MIN_GLOBAL_API_INTERVAL_MS = 200; // Max 5 API calls/sec total
  
  // Quote caching - skip API if quote unchanged
  private lastSentQuote: Map<string, { bidPrice: number; askPrice: number; bidSize: number; askSize: number }> = new Map();

  // Logging
  private logFile: string;
  private fillsLogFile: string;  // JSONL structured fill log
  private sessionId: string;     // Unique session identifier
  private sessionStartTime: number = 0;
  private lastSummaryTime: number = 0;
  private readonly SUMMARY_INTERVAL_MS = 60000; // Log summary every minute

  // Rate-limit rejection log messages (key = reason, value = last log timestamp)
  private _rejectionLogTimes: Map<string, number> = new Map();

  // Market metadata cache (for expiry times)
  private marketMetadata: Map<string, MarketMetadata> = new Map();
  private readonly METADATA_CACHE_MS = 300_000; // 5 minutes

  // Stale order enforcement
  private lastStaleCheck: number = 0;
  private readonly STALE_CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds

  // Connection health monitoring
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds
  private readonly STALE_DATA_THRESHOLD_MS = 120_000; // 2 minutes without data = stale
  private readonly FORCE_RECONNECT_THRESHOLD_MS = 300_000; // 5 minutes without data = force reconnect
  private disconnectedSince: number | null = null; // When did we lose the connection?
  private ordersCleanedOnDisconnect = false; // Have we cancelled orders since disconnect?

  constructor(config: Config) {
    // Generate unique session ID
    this.sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sessionStartTime = Date.now();

    // Set up log files
    const logsDir = join(process.cwd(), "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    const date = new Date().toISOString().split("T")[0];
    this.logFile = join(logsDir, `mm-${date}.log`);
    this.fillsLogFile = join(logsDir, `fills-${date}.jsonl`);

    this.config = config;
    this.credentials = getKalshiCredentials();
    this.basePath = getBasePath(config.kalshi.demo);

    // Initialize components
    this.inventory = new InventoryTracker();
    this.risk = new RiskManager(config.risk as RiskLimits);
    this.strategy = createStrategy(config.strategy);
    this.orderbookManager = new OrderbookManager();
    this.adverseDetector = new AdverseSelectionDetector();
    
    // Initialize advanced risk controls with config (or defaults)
    this.drawdownManager = new DrawdownManager();
    this.circuitBreaker = new CircuitBreaker();

    // Initialize active markets from config
    for (const m of config.markets) {
      this.activeMarkets.add(m);
    }

    // Check if scanner is enabled
    this.scannerEnabled = config.scanner?.enabled ?? false;

    log("Bot", `Strategy: ${this.strategy.name}`);
    log("Bot", `Mode: ${config.kalshi.demo ? "DEMO" : "PRODUCTION"}`);
    log("Bot", `Scanner: ${this.scannerEnabled ? "ENABLED" : "disabled"}`);
    log("Bot", `Static markets: ${config.markets.length > 0 ? config.markets.join(", ") : "(none - scanner will provide)"}`);
    log("Bot", `Log file: ${this.logFile}`);
    log("Bot", `Fills log: ${this.fillsLogFile}`);
    log("Bot", `Session: ${this.sessionId}`);

    // ─── Structured session start ───
    this.logToFile(`\n${"=".repeat(60)}`);
    this.logToFile(`=== SESSION START: ${this.sessionId} ===`);
    this.logToFile(`${"=".repeat(60)}`);
    this.logToFile(`Strategy: ${this.strategy.name}`);
    this.logToFile(`Mode: ${config.kalshi.demo ? "DEMO" : "PRODUCTION"}`);
    this.logToFile(`Scanner: ${this.scannerEnabled ? "ENABLED" : "disabled"}`);
    this.logToFile(`Static markets: ${config.markets.length > 0 ? config.markets.join(", ") : "(none)"}`);
    this.logToFile(`Risk limits: maxPos=${config.risk.maxPositionPerMarket} maxExposure=${config.risk.maxTotalExposure} maxDailyLoss=${config.risk.maxDailyLoss}¢ maxOrder=${config.risk.maxOrderSize}`);
    this.logToFile(`Config snapshot: ${JSON.stringify({ strategy: config.strategy.name, scanner: config.scanner, risk: config.risk })}`);

    // Write session start to JSONL fills log
    this.logFillJsonl({
      type: "session_start",
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      config: {
        strategy: config.strategy.name,
        mode: config.kalshi.demo ? "demo" : "production",
        scanner: config.scanner,
        risk: config.risk,
      },
    });
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

      // === SCANNER: Initial scan if enabled ===
      if (this.scannerEnabled) {
        this.scanner = new MarketScanner(this.marketApi!, this.config.scanner as Partial<ScannerConfig>);
        log("Bot", "Running initial market scan (checking cache first)...");
        try {
          const { result, fromCache, refreshing } = await this.scanner.scanWithCache();
          this.lastScanResult = result;
          const scannedTickers = this.scanner.getRecommendedTickers();
          
          // Add scanned markets to active set (alongside any static ones)
          for (const ticker of scannedTickers) {
            this.activeMarkets.add(ticker);
          }
          
          const cacheTag = fromCache ? " (from cache)" : "";
          console.log(formatScanResults(result));
          log("Bot", `Scanner added ${scannedTickers.length} markets${cacheTag} (total active: ${this.activeMarkets.size})`);
          this.logToFile(`Scanner: ${scannedTickers.length} markets found${cacheTag}`);

          // If cache was stale, schedule a background refresh
          if (refreshing) {
            log("Bot", "Background scan refresh starting...");
            const scanConfig = this.config.scanner;
            const freshScanPromise = scanConfig.deepScan
              ? this.scanner.deepScan()
              : this.scanner.scan();
            freshScanPromise.then(async (freshResult) => {
              log("Bot", `Background refresh complete: ${freshResult.markets.length} markets`);
              await this.onScanComplete(freshResult);
            }).catch((err) => {
              console.error("[Bot] Background refresh failed:", err);
            });
          }
        } catch (error) {
          console.error("[Bot] Scanner failed, continuing with static markets:", error);
          this.logToFile(`Scanner failed: ${error}`);
        }
      }

      // Validate we have markets to trade
      if (this.activeMarkets.size === 0) {
        throw new Error(
          "No markets to trade! Either add markets to config.yaml or enable the scanner."
        );
      }

      // === P0: ORDER RECONCILIATION ON STARTUP ===
      // Cancel any orphan orders from previous sessions for our markets
      await this.reconcileOrdersOnStartup();

      // Sync existing positions from Kalshi
      await this.syncPositions();

      // Fetch market metadata (including expiry times)
      await this.fetchMarketMetadata();

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

      // Start periodic scanner if enabled
      if (this.scannerEnabled && this.scanner) {
        this.scanner.startPeriodicScan(async (result) => {
          await this.onScanComplete(result);
        });
      }

      // Keep alive (the bot runs via WebSocket events)
      while (this.running) {
        await this.sleep(1000);

        // Periodic cleanup
        if (this.orderManager) {
          this.orderManager.cleanup();
        }

        // === CONNECTION HEALTH MONITOR ===
        await this.checkConnectionHealth();

        // Check if circuit breaker has cooled down - auto-resume
        if (this.paused && !this.circuitBreaker.isTriggered() && !this.drawdownManager.shouldHalt()) {
          console.log("[Bot] 🟢 Risk controls cleared - auto-resuming");
          this.logToFile("Auto-resuming after risk cooldown");
          this.paused = false;
        }

        // === P1: STALE ORDER ENFORCEMENT ===
        await this.enforceStaleOrders();

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

    // Stop scanner
    if (this.scanner) {
      this.scanner.stopPeriodicScan();
    }

    // Cancel all orders
    if (this.orderManager) {
      const cancelled = await this.orderManager.cancelAll();
      console.log(`[Bot] Cancelled ${cancelled} orders`);
    }

    // Disconnect WebSocket
    if (this.ws) {
      this.ws.disconnect();
    }

    // ─── Structured session end ───
    const pnl = this.inventory.getPnLSummary();
    const durationMs = Date.now() - this.sessionStartTime;
    const durationMin = (durationMs / 60000).toFixed(1);

    this.logToFile(`\n${"─".repeat(60)}`);
    this.logToFile(`=== SESSION END: ${this.sessionId} ===`);
    this.logToFile(`Duration: ${durationMin} minutes`);
    this.logToFile(`Fills: ${pnl.fillsToday} | Volume: ${pnl.volumeToday} contracts`);
    this.logToFile(`Realized P&L: ${pnl.realizedToday}¢ ($${(pnl.realizedToday / 100).toFixed(2)})`);
    this.logToFile(`Markets traded: ${[...this.activeMarkets].join(", ")}`);
    this.logToFile(`${"─".repeat(60)}\n`);

    // Write session end to JSONL fills log
    this.logFillJsonl({
      type: "session_end",
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      durationMin: parseFloat(durationMin),
      pnl: {
        realized: pnl.realizedToday,
        fills: pnl.fillsToday,
        volume: pnl.volumeToday,
      },
      markets: [...this.activeMarkets],
    });

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
    // Clear quote cache so we re-quote fresh when resumed
    this.lastSentQuote.clear();
  }

  /**
   * Get current bot state
   */
  getState(): BotState {
    const now = Date.now();
    const lastData = this.ws?.lastDataReceived ?? 0;

    return {
      running: this.running,
      paused: this.paused,
      connected: this.ws?.isConnected ?? false,
      markets: this.getActiveMarkets(),
      activeOrders: this.orderManager?.getActive().length ?? 0,
      positions: this.inventory.getAllPositions(),
      pnl: this.inventory.getPnLSummary(),
      risk: this.risk.getStatus(this.inventory),
      drawdown: this.drawdownManager.getStatus(),
      circuitBreaker: this.circuitBreaker.getStatus(),
      connectionHealth: {
        wsState: this.ws?.connectionState ?? "disconnected",
        lastDataAgeSec: lastData > 0 ? Math.floor((now - lastData) / 1000) : null,
        disconnectedForSec: this.disconnectedSince
          ? Math.floor((now - this.disconnectedSince) / 1000)
          : null,
        reconnectAttempts: 0, // WS client doesn't expose this, but we track it via logs
      },
      scanner: this.scannerEnabled ? {
        enabled: true,
        lastScan: this.lastScanResult?.timestamp ?? null,
        marketsFound: this.lastScanResult?.markets.length ?? 0,
      } : undefined,
    };
  }

  /**
   * Get the active market list (static config + scanner results).
   */
  getActiveMarkets(): string[] {
    return Array.from(this.activeMarkets);
  }

  /**
   * Add a market dynamically.
   * @param ticker Market ticker to add
   * @param pin If true, mark as "pinned" so the scanner won't remove it
   */
  async addMarket(ticker: string, pin = false): Promise<void> {
    if (pin) {
      this.pinnedMarkets.add(ticker);
    }

    if (this.activeMarkets.has(ticker)) {
      if (pin) log("Bot", `Market ${ticker} pinned (already active)`);
      return;
    }

    this.activeMarkets.add(ticker);
    this.marketPnL.set(ticker, { realized: 0, fills: 0, addedAt: Date.now() });

    // Subscribe to WebSocket channels
    if (this.ws?.isConnected) {
      this.ws.subscribe(["ticker", "orderbook_delta"], [ticker]);
    }

    // Fetch metadata
    if (this.marketApi) {
      try {
        const response = await this.marketApi.getMarket(ticker);
        const market = response.data?.market;
        if (market) this.cacheMarketMetadata(market);
      } catch {
        // Non-critical, continue
      }
    }

    log("Bot", `Added market: ${ticker} (total: ${this.activeMarkets.size})`);
    this.logToFile(`Market added: ${ticker}`);
  }

  /**
   * Remove a market dynamically.
   * Cancels any outstanding orders for that market.
   */
  async removeMarket(ticker: string): Promise<void> {
    if (!this.activeMarkets.has(ticker)) return;

    // Cancel orders for this market
    if (this.orderManager) {
      try {
        await this.orderManager.cancelAllAndClear([ticker]);
      } catch {
        // Best effort
      }
    }

    this.activeMarkets.delete(ticker);
    this.pinnedMarkets.delete(ticker); // Unpin if pinned
    this.lastSentQuote.delete(ticker);
    this.lastQuoteUpdate.delete(ticker);
    this.lastBBO.delete(ticker);
    this.marketData.delete(ticker);

    // Note: we don't unsubscribe from WS channels since it's harmless
    // and the next reconnect will clean up

    log("Bot", `Removed market: ${ticker} (total: ${this.activeMarkets.size})`);
    this.logToFile(`Market removed: ${ticker}`);
  }

  /**
   * Get the scanner instance (for API endpoints).
   */
  getScanner(): MarketScanner | null {
    return this.scanner;
  }

  /**
   * Get per-market P&L data.
   */
  getMarketPnL(): Map<string, { realized: number; fills: number; addedAt: number }> {
    return new Map(this.marketPnL);
  }

  /**
   * Get last scan result.
   */
  getLastScanResult(): ScanResult | null {
    return this.lastScanResult;
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): Record<string, number | string | boolean> {
    const state = this.getState();
    const latency = this.getLatencyStats();
    const flaggedMarkets = this.adverseDetector.getFlaggedMarkets();
    
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
      // Latency metrics
      latency_p50: latency.p50,
      latency_p95: latency.p95,
      latency_p99: latency.p99,
      latency_max: latency.max,
      // Adverse selection
      adverseFlagged: flaggedMarkets.length,
      adverseMarkets: flaggedMarkets.join(",") || "none",
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
    const wasDisconnected = this.disconnectedSince !== null;
    const downtime = wasDisconnected
      ? ((Date.now() - this.disconnectedSince!) / 1000).toFixed(0)
      : null;

    // Reset disconnect tracking
    this.disconnectedSince = null;
    this.ordersCleanedOnDisconnect = false;

    if (wasDisconnected) {
      console.log(`[Bot] ✅ WebSocket reconnected after ${downtime}s downtime`);
      this.logToFile(`WebSocket reconnected after ${downtime}s`);
    } else {
      console.log("[Bot] WebSocket connected");
    }

    // Subscribe to ticker + orderbook_delta for our markets, plus fill channel
    if (this.ws) {
      const marketList = this.getActiveMarkets();
      this.ws.subscribe(["ticker", "orderbook_delta"], marketList);
      this.ws.subscribe(["fill"]); // Authenticated channel for our fills
      log("Bot", `Subscribed to ${marketList.length} markets`);
      console.log("[Bot] Waiting for market data...");
    }

    // If reconnecting, sync positions in case we missed fills
    if (wasDisconnected) {
      await this.syncPositions();
    }
  }

  private async onDisconnect(): Promise<void> {
    this.disconnectedSince = Date.now();
    console.log("[Bot] ⚠️ WebSocket disconnected — auto-reconnect will retry");
    this.logToFile("WebSocket disconnected");

    // Safety: cancel all resting orders since we can't monitor the market
    await this.cancelOrdersOnDisconnect();
  }

  /**
   * Cancel all resting orders when disconnected (safety measure).
   * We can't monitor fills or market changes without the WebSocket,
   * so leaving orders on the book is dangerous.
   */
  private async cancelOrdersOnDisconnect(): Promise<void> {
    if (this.ordersCleanedOnDisconnect || !this.orderManager) return;

    try {
      const cancelled = await this.orderManager.cancelAll();
      this.ordersCleanedOnDisconnect = true;
      if (cancelled > 0) {
        console.log(`[Bot] 🧹 Cancelled ${cancelled} orders (safety: WS disconnected)`);
        this.logToFile(`Cancelled ${cancelled} orders on disconnect`);
      }
    } catch (error) {
      console.error("[Bot] Failed to cancel orders on disconnect:", error);
    }
  }

  /**
   * === P0: ORDER RECONCILIATION ON STARTUP ===
   * Cancel any orphan orders from previous sessions for our markets
   */
  private async reconcileOrdersOnStartup(): Promise<void> {
    if (!this.orderManager) return;

    console.log("[Bot] 🔄 Reconciling orders on startup...");
    this.logToFile("Order reconciliation started");

    try {
      // Cancel all resting orders for our configured markets
      const cancelled = await this.orderManager.cancelAllAndClear(this.getActiveMarkets());

      if (cancelled > 0) {
        log("Bot", `✅ Cancelled ${cancelled} orphan orders from previous sessions`);
        this.logToFile(`Cancelled ${cancelled} orphan orders`);
      } else {
        console.log("[Bot] ✅ No orphan orders found");
        this.logToFile("No orphan orders found");
      }
    } catch (error) {
      console.error("[Bot] ⚠️ Order reconciliation failed:", error);
      this.logToFile(`Order reconciliation failed: ${error}`);
      // Continue anyway - we'll manage new orders going forward
    }
  }

  /**
   * === P0: FETCH MARKET METADATA (including expiry times) ===
   */
  private async fetchMarketMetadata(): Promise<void> {
    if (!this.marketApi) return;

    console.log("[Bot] 📊 Fetching market metadata...");

    for (const ticker of this.getActiveMarkets()) {
      try {
        const response = await this.marketApi.getMarket(ticker);
        const market = response.data?.market;

        if (market) {
          this.cacheMarketMetadata(market);
          
          const meta = this.marketMetadata.get(ticker);
          if (meta?.closeTime) {
            const timeToExpiry = Math.floor((meta.closeTime.getTime() - Date.now()) / 1000);
            const hours = Math.floor(timeToExpiry / 3600);
            const mins = Math.floor((timeToExpiry % 3600) / 60);
            console.log(`   ${ticker}: closes in ${hours}h ${mins}m (status: ${meta.status})`);
          } else {
            console.log(`   ${ticker}: no close time (status: ${meta?.status ?? "unknown"})`);
          }
        }
      } catch (error) {
        console.error(`[Bot] ⚠️ Failed to fetch metadata for ${ticker}:`, error);
      }
    }
  }

  /**
   * Cache market metadata from API response
   */
  private cacheMarketMetadata(market: Market): void {
    const metadata: MarketMetadata = {
      ticker: market.ticker ?? "",
      closeTime: market.close_time ? new Date(market.close_time) : null,
      expirationTime: market.expiration_time ? new Date(market.expiration_time) : null,
      status: market.status ?? "unknown",
      lastFetched: Date.now(),
    };
    this.marketMetadata.set(metadata.ticker, metadata);
  }

  /**
   * Get time to expiry in seconds for a market
   */
  private getTimeToExpiry(ticker: string): number | undefined {
    const meta = this.marketMetadata.get(ticker);
    if (!meta) return undefined;

    // Prefer close_time, fallback to expiration_time
    const expiryTime = meta.closeTime ?? meta.expirationTime;
    if (!expiryTime) return undefined;

    const now = Date.now();
    const timeToExpiry = Math.floor((expiryTime.getTime() - now) / 1000);

    // Return undefined if already expired
    return timeToExpiry > 0 ? timeToExpiry : undefined;
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
        this.activeMarkets.has(p.ticker)
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
      log("Bot", `✅ Synced ${relevantPositions.length} positions:`);
      for (const p of relevantPositions) {
        const pos = p.position;
        const side = pos > 0 ? "YES" : "NO";
        const exposure = (p.market_exposure / 100).toFixed(2);
        console.log(`   ${p.ticker}: ${Math.abs(pos)} ${side} ($${exposure} exposure)`);
        this.logToFile(`Position sync: ${p.ticker} ${Math.abs(pos)} ${side}`);
      }

      // Also log any positions in OTHER markets (warning)
      const otherPositions = positions.filter(p =>
        !this.activeMarkets.has(p.ticker) && p.position !== 0
      );
      if (otherPositions.length > 0) {
        log("Bot", `⚠️ You have ${otherPositions.length} positions in OTHER markets (not managed by this bot)`);
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

  /**
   * === CONNECTION HEALTH MONITOR ===
   * Runs periodically in the main loop. Detects stale connections
   * and forces a full reconnect if the WS is silently dead.
   */
  private async checkConnectionHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL_MS) return;
    this.lastHealthCheck = now;

    if (!this.ws) return;

    // Check 1: Are we currently disconnected/reconnecting?
    if (this.disconnectedSince) {
      const downMs = now - this.disconnectedSince;
      const downSec = Math.floor(downMs / 1000);

      // If we've been down for a long time, try a full fresh reconnect
      if (downMs > this.FORCE_RECONNECT_THRESHOLD_MS) {
        console.log(`[Bot] 🔄 WS down for ${downSec}s — forcing full reconnect`);
        this.logToFile(`Force reconnect after ${downSec}s downtime`);

        try {
          await this.ws.forceReconnect();
        } catch (error) {
          console.error("[Bot] Force reconnect failed:", error);
          // Will retry on next health check
        }
      }
      return;
    }

    // Check 2: Stale data detection (connected but no data flowing)
    const lastData = this.ws.lastDataReceived;
    if (lastData > 0) {
      const staleness = now - lastData;

      if (staleness > this.FORCE_RECONNECT_THRESHOLD_MS) {
        // Very stale — force reconnect
        console.log(
          `[Bot] 🔄 No data for ${Math.floor(staleness / 1000)}s — forcing WS reconnect`
        );
        this.logToFile(`Force reconnect: no data for ${Math.floor(staleness / 1000)}s`);

        // Cancel orders first (safety)
        await this.cancelOrdersOnDisconnect();

        try {
          await this.ws.forceReconnect();
        } catch (error) {
          console.error("[Bot] Force reconnect failed:", error);
        }
      } else if (staleness > this.STALE_DATA_THRESHOLD_MS) {
        // Warning level — log but don't act yet
        console.log(
          `[Bot] ⚠️ No data for ${Math.floor(staleness / 1000)}s — connection may be stale`
        );
      }
    }
  }

  private async onOrderbookSnapshot(data: OrderbookSnapshot): Promise<void> {
    const ticker = data.market_ticker;
    if (!ticker || !this.activeMarkets.has(ticker)) return;

    // Apply snapshot to local orderbook
    this.orderbookManager.applySnapshot(data);

    // Get BBO from local orderbook
    const bbo = this.orderbookManager.getBBO(ticker);
    if (!bbo) return;

    const { bidPrice: bestBid, askPrice: bestAsk } = bbo;

    // Also get microprice for logging
    const ob = this.orderbookManager.getOrderbook(ticker);
    const microprice = ob.getMicroprice();
    const imbalance = ob.getImbalance();

    log("Bot", 
      `📊 ${ticker} ${bestBid}¢/${bestAsk}¢ (spread ${bbo.spread}¢) | ` +
      `μ=${microprice?.toFixed(1)}¢ imb=${(imbalance * 100).toFixed(0)}%`
    );

    if (this.paused || this.risk.shouldHalt()) return;

    // Update legacy market data for backward compatibility
    this.marketData.set(ticker, { bestBid, bestAsk });

    // DEBOUNCE: Check if we should update quotes
    if (!this.shouldUpdateQuotes(ticker, bestBid, bestAsk)) {
      return; // Skip this update - too soon or no significant change
    }

    // Generate and place quotes
    const startTime = Date.now();
    await this.updateQuotes(ticker);
    this.trackLatency(Date.now() - startTime);

    // Record this update
    this.lastQuoteUpdate.set(ticker, Date.now());
    this.lastBBO.set(ticker, { bid: bestBid, ask: bestAsk });
  }

  private async onOrderbookDelta(data: OrderbookDelta): Promise<void> {
    const ticker = data.market_ticker;
    if (!ticker || !this.activeMarkets.has(ticker)) return;

    // Apply delta to local orderbook (FAST - no parsing needed)
    this.orderbookManager.applyDelta(data);

    // Skip if paused or halted
    if (this.paused || this.risk.shouldHalt()) return;

    // Get updated BBO
    const bbo = this.orderbookManager.getBBO(ticker);
    if (!bbo) return;

    // Update legacy market data
    this.marketData.set(ticker, { 
      bestBid: bbo.bidPrice, 
      bestAsk: bbo.askPrice 
    });

    // DEBOUNCE: Check if we should update quotes
    if (!this.shouldUpdateQuotes(ticker, bbo.bidPrice, bbo.askPrice)) {
      return; // Skip this update
    }

    // Update quotes
    const startTime = Date.now();
    await this.updateQuotes(ticker);
    this.trackLatency(Date.now() - startTime);

    // Record this update
    this.lastQuoteUpdate.set(ticker, Date.now());
    this.lastBBO.set(ticker, { bid: bbo.bidPrice, ask: bbo.askPrice });
  }

  private async onTicker(data: TickerData): Promise<void> {
    const ticker = data.market_ticker;

    // Skip if not in our market list
    if (!this.activeMarkets.has(ticker)) return;

    // Skip if paused or halted
    if (this.paused || this.risk.shouldHalt()) return;

    const bestBid = data.yes_bid ?? 0;
    const bestAsk = data.yes_ask ?? 0;

    // Update market data
    this.marketData.set(ticker, { bestBid, bestAsk });

    // DEBOUNCE: Check if we should update quotes
    if (!this.shouldUpdateQuotes(ticker, bestBid, bestAsk)) {
      return; // Skip this update - too soon or no significant change
    }

    // Generate and place quotes
    const startTime = Date.now();
    await this.updateQuotes(ticker);
    this.trackLatency(Date.now() - startTime);

    // Record this update
    this.lastQuoteUpdate.set(ticker, Date.now());
    this.lastBBO.set(ticker, { bid: bestBid, ask: bestAsk });
  }

  private async onFill(data: FillData): Promise<void> {
    // Get price based on side (yes_price for YES, no_price for NO)
    const price = data.side === "yes" ? data.yes_price : data.no_price;
    const ticker = data.market_ticker || data.ticker || "";
    
    const fill = {
      orderId: data.order_id,
      ticker,
      side: data.side,
      action: data.action,
      count: data.count,
      price,
      timestamp: new Date(),
    };

    // === P0: LINK FILL TO ORDER STATUS ===
    // Update order manager so we know which orders are filled/partial
    if (this.orderManager) {
      const updated = this.orderManager.onFill(data.order_id, data.count);
      if (!updated) {
        // Order not found - could be from previous session or external
        console.log(`[Bot] ℹ️ Fill for untracked order ${data.order_id.slice(0, 8)}...`);
      }
    }

    // Record for adverse selection tracking
    const bbo = this.orderbookManager.getBBO(ticker);
    const currentPrice = bbo?.midPrice ?? price;
    
    const fillRecord: FillRecord = {
      ticker,
      side: data.side,
      action: data.action,
      price,
      timestamp: Date.now(),
    };
    this.adverseDetector.recordFill(fillRecord, currentPrice);

    // Get P&L BEFORE fill for comparison
    const pnlBefore = this.inventory.getPnLSummary();

    // Update inventory
    this.inventory.onFill(fill);

    // Get position AFTER fill
    const positionAfter = this.inventory.getPosition(ticker);
    const pnlAfter = this.inventory.getPnLSummary();

    // Calculate realized P&L from this fill
    const realizedFromFill = pnlAfter.realizedToday - pnlBefore.realizedToday;

    // Format fill log with emoji and details
    const emoji = data.action === "buy" ? "🟢" : "🔴";
    const cost = data.count * price;
    const netPos = positionAfter?.netExposure ?? 0;
    const posDir = netPos > 0 ? "LONG" : netPos < 0 ? "SHORT" : "FLAT";

    console.log(
      `\n${emoji} FILL: ${data.action.toUpperCase()} ${data.count}x ${data.side.toUpperCase()} @ ${price}¢`
    );
    console.log(`         Market: ${ticker}`);
    console.log(`         Cost: ${cost}¢ ($${(cost / 100).toFixed(2)})`);
    console.log(`         Position: ${Math.abs(netPos)} contracts ${posDir}`);

    if (realizedFromFill !== 0) {
      const pnlEmoji = realizedFromFill > 0 ? "💰" : "💸";
      console.log(`         ${pnlEmoji} Realized P&L: ${realizedFromFill > 0 ? "+" : ""}${realizedFromFill}¢ ($${(realizedFromFill / 100).toFixed(2)})`);
    }

    console.log(`         📊 Session: ${pnlAfter.fillsToday} fills, ${pnlAfter.volumeToday} contracts, P&L: ${pnlAfter.realizedToday > 0 ? "+" : ""}${pnlAfter.realizedToday}¢\n`);

    // Log to file
    this.logFillToFile(data, realizedFromFill, pnlAfter.realizedToday);

    // Track per-market P&L
    const mktPnl = this.marketPnL.get(ticker) ?? { realized: 0, fills: 0, addedAt: Date.now() };
    mktPnl.realized += realizedFromFill;
    mktPnl.fills += 1;
    this.marketPnL.set(ticker, mktPnl);

    // Notify strategy
    this.strategy.onFill(fill);

    // Update risk with realized P&L
    this.risk.onFill(fill, realizedFromFill);
    
    // === ADVANCED RISK CONTROLS ===
    
    // Update drawdown tracking
    this.drawdownManager.updatePnL(pnlAfter.realizedToday);
    const drawdownStatus = this.drawdownManager.getStatus();
    if (drawdownStatus.shouldHalt) {
      console.warn(`[Bot] 🛑 DRAWDOWN HALT: Drawdown ${drawdownStatus.drawdown}¢ exceeds limit. Pausing.`);
      this.logToFile(`DRAWDOWN HALT: ${drawdownStatus.drawdown}¢`);
      this.paused = true;
    } else if (drawdownStatus.positionMultiplier < 1.0) {
      console.log(`[Bot] ⚠️ Drawdown scaling: ${Math.round(drawdownStatus.positionMultiplier * 100)}% size (drawdown: ${drawdownStatus.drawdown}¢)`);
    }
    
    // Update circuit breaker
    const circuitTriggered = this.circuitBreaker.onFill(realizedFromFill);
    if (circuitTriggered) {
      const cbStatus = this.circuitBreaker.getStatus();
      console.warn(`[Bot] 🚨 CIRCUIT BREAKER: ${cbStatus.reason}. Cooldown: ${Math.round((cbStatus.timeUntilReset ?? 0) / 1000)}s`);
      this.logToFile(`CIRCUIT BREAKER: ${cbStatus.reason}`);
      this.paused = true;
    }
    
    // Invalidate quote cache - position changed, need to re-quote with new inventory skew
    this.lastSentQuote.delete(ticker);
  }

  private async updateQuotes(ticker: string): Promise<void> {
    if (!this.orderManager) return;

    const data = this.marketData.get(ticker);
    if (!data) return;

    // ─── EARLY EXIT: Skip quoting when at or over max exposure ───
    // This prevents computing quotes, sending them to risk, and logging
    // rejection messages hundreds of times per minute while maxed out.
    const totalExposure = this.inventory.getTotalExposure();
    const maxExposure = this.config.risk.maxTotalExposure;
    if (totalExposure >= maxExposure) {
      return; // Silently skip -- nothing we can do until exposure frees up
    }

    // Get enhanced orderbook data
    const ob = this.orderbookManager.getOrderbook(ticker);
    const bbo = ob.getBBO();
    const microprice = ob.getMicroprice();
    const imbalance = ob.getImbalance();

    // Check adverse selection
    const adverseSelection = this.adverseDetector.isAdverse(ticker);
    
    // Update adverse detector with current price
    if (bbo) {
      this.adverseDetector.updatePrice(ticker, bbo.midPrice);
    }

    // Build market snapshot with enhanced data
    const position = this.inventory.getPosition(ticker) ?? null;
    const mid = (data.bestBid + data.bestAsk) / 2;

    // === P0: POPULATE timeToExpiry ===
    const timeToExpiry = this.getTimeToExpiry(ticker);

    const snapshot: MarketSnapshot = {
      ticker,
      bestBid: data.bestBid,
      bestAsk: data.bestAsk,
      mid,
      spread: data.bestAsk - data.bestBid,
      position,
      // Enhanced data (Phase 2)
      microprice: microprice ?? undefined,
      bidSize: bbo?.bidSize,
      askSize: bbo?.askSize,
      imbalance,
      adverseSelection,
      // P0: Time to expiry for strategy decisions
      timeToExpiry,
    };

    // Get quotes from strategy
    const quotes = this.strategy.computeQuotes(snapshot);
    
    // Apply drawdown position scaling
    const positionMultiplier = this.drawdownManager.getPositionMultiplier();

    // Place quotes (risk check happens inside updateQuote)
    const maxOrderSize = this.config.risk.maxOrderSize;
    for (const quote of quotes) {
      // Apply drawdown scaling to sizes, then clamp to maxOrderSize
      // IMPORTANT: Preserve 0 sizes from strategy (skip risky side protection)
      const scaledQuote = {
        ...quote,
        bidSize: quote.bidSize === 0 ? 0 : Math.min(maxOrderSize, Math.max(1, Math.floor(quote.bidSize * positionMultiplier))),
        askSize: quote.askSize === 0 ? 0 : Math.min(maxOrderSize, Math.max(1, Math.floor(quote.askSize * positionMultiplier))),
      };
      
      // If multiplier is 0, skip quoting entirely
      if (positionMultiplier === 0) {
        continue;
      }
      
      // QUOTE CACHING: Skip API call if quote is identical to last sent
      const lastQuote = this.lastSentQuote.get(scaledQuote.ticker);
      if (lastQuote && 
          lastQuote.bidPrice === scaledQuote.bidPrice && 
          lastQuote.askPrice === scaledQuote.askPrice &&
          lastQuote.bidSize === scaledQuote.bidSize &&
          lastQuote.askSize === scaledQuote.askSize) {
        // Quote unchanged - skip API call entirely
        continue;
      }

      const check = this.risk.checkQuote(scaledQuote, this.inventory);
      if (!check.allowed) {
        // Rate-limit rejection logs: at most once per 30 seconds per reason
        const now = Date.now();
        const reasonKey = check.reason ?? "unknown";
        const lastLog = this._rejectionLogTimes.get(reasonKey) ?? 0;
        if (now - lastLog >= 30_000) {
          console.log(`[Bot] ⚠️ Quote rejected: ${reasonKey}`);
          this._rejectionLogTimes.set(reasonKey, now);
        }
        continue;
      }

      // ─── MAKER PROTECTION: Final spread-crossing guard ───
      // Re-fetch the freshest BBO right before placing to prevent crossing
      // when local orderbook data lags the real market.
      const freshBBO = this.orderbookManager.getBBO(scaledQuote.ticker);
      if (freshBBO) {
        if (scaledQuote.bidSize > 0 && scaledQuote.bidPrice >= freshBBO.askPrice) {
          scaledQuote.bidPrice = Math.max(1, Math.min(99, freshBBO.askPrice - 1));
          if (scaledQuote.bidPrice <= 0) scaledQuote.bidSize = 0;
        }
        if (scaledQuote.askSize > 0 && scaledQuote.askPrice <= freshBBO.bidPrice) {
          scaledQuote.askPrice = Math.max(1, Math.min(99, freshBBO.bidPrice + 1));
          if (scaledQuote.askPrice > 99) scaledQuote.askSize = 0;
        }
        if (scaledQuote.bidSize > 0 && scaledQuote.askSize > 0 && scaledQuote.bidPrice >= scaledQuote.askPrice) {
          // Spread collapsed - skip this quote cycle
          continue;
        }
        if (scaledQuote.bidSize === 0 && scaledQuote.askSize === 0) continue;
      }

      try {
        await this.orderManager.updateQuote(scaledQuote);
        
        // Cache the quote we just sent
        this.lastSentQuote.set(scaledQuote.ticker, {
          bidPrice: scaledQuote.bidPrice,
          askPrice: scaledQuote.askPrice,
          bidSize: scaledQuote.bidSize,
          askSize: scaledQuote.askSize,
        });
        
        const adverseTag = adverseSelection ? " [ADVERSE]" : "";
        const scaleTag = positionMultiplier < 1.0 ? ` [${Math.round(positionMultiplier * 100)}%]` : "";
        log("Bot", `📝 Quote: ${scaledQuote.ticker} ${scaledQuote.bidSize}x@${scaledQuote.bidPrice}¢ / ${scaledQuote.askSize}x@${scaledQuote.askPrice}¢${adverseTag}${scaleTag}`);
      } catch (error) {
        console.error(`[Bot] ❌ Quote failed for ${ticker}:`, error);
      }
    }
  }

  /**
   * Handle scan completion - update active markets.
   */
  private async onScanComplete(result: ScanResult): Promise<void> {
    this.lastScanResult = result;
    const newTickers = new Set(result.markets.map((m) => m.ticker));

    // Also keep any static config markets
    for (const m of this.config.markets) {
      newTickers.add(m);
    }

    // Find markets to add and remove
    const toAdd: string[] = [];
    const toRemove: string[] = [];

    for (const ticker of newTickers) {
      if (!this.activeMarkets.has(ticker)) {
        toAdd.push(ticker);
      }
    }

    for (const ticker of this.activeMarkets) {
      // Don't remove static config markets or pinned markets
      if (!newTickers.has(ticker) && !this.config.markets.includes(ticker) && !this.pinnedMarkets.has(ticker)) {
        // Don't remove if we have an open position
        const pos = this.inventory.getPosition(ticker);
        if (pos && pos.netExposure !== 0) {
          continue; // Keep until position is flat
        }
        toRemove.push(ticker);
      }
    }

    // Apply changes
    for (const ticker of toRemove) {
      await this.removeMarket(ticker);
    }
    for (const ticker of toAdd) {
      await this.addMarket(ticker);
    }

    if (toAdd.length > 0 || toRemove.length > 0) {
      log("Bot", `Scanner update: +${toAdd.length} -${toRemove.length} markets (total: ${this.activeMarkets.size})`);
      this.logToFile(`Scanner update: +${toAdd.length} -${toRemove.length} (total: ${this.activeMarkets.size})`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * === P1: STALE ORDER ENFORCEMENT ===
   * Cancel orders that are too old or too far from current fair value
   */
  private async enforceStaleOrders(): Promise<void> {
    const now = Date.now();
    
    // Rate limit this check
    if (now - this.lastStaleCheck < this.STALE_CHECK_INTERVAL_MS) {
      return;
    }
    this.lastStaleCheck = now;

    if (!this.orderManager || this.paused || this.risk.shouldHalt()) {
      return;
    }

    const staleOrderMs = this.config.daemon.staleOrderMs;

    // Check each market we're quoting
    for (const ticker of this.activeMarkets) {
      // Get current fair value
      const ob = this.orderbookManager.getOrderbook(ticker);
      const bbo = ob.getBBO();
      if (!bbo) continue;

      const fairValue = ob.getMicroprice() ?? bbo.midPrice;

      // Find stale orders (by time)
      const staleByTime = this.orderManager.getStaleOrders(staleOrderMs)
        .filter(o => o.ticker === ticker);

      // Find orders too far from fair value (> 5¢ off)
      const staleByPrice = this.orderManager.getOffPriceOrders(ticker, fairValue, 5);

      // Combine and dedupe
      const orderIdsToCancel = new Set<string>();
      for (const order of [...staleByTime, ...staleByPrice]) {
        if (order.id) {
          orderIdsToCancel.add(order.id);
        }
      }

      if (orderIdsToCancel.size > 0) {
        try {
          const cancelled = await this.orderManager.batchCancel(Array.from(orderIdsToCancel));
          
          if (cancelled > 0) {
            log("Bot", `🧹 Cancelled ${cancelled} stale orders for ${ticker}`);
            this.logToFile(`Stale order cleanup: ${cancelled} orders for ${ticker}`);
            
            // Invalidate quote cache to re-quote fresh
            this.lastSentQuote.delete(ticker);
          }
        } catch (error) {
          console.error(`[Bot] ⚠️ Failed to cancel stale orders for ${ticker}:`, error);
        }
      }
    }
  }

  /**
   * Check if we should update quotes (debouncing + significant change detection)
   */
  private shouldUpdateQuotes(ticker: string, newBid: number, newAsk: number): boolean {
    const now = Date.now();
    const lastUpdate = this.lastQuoteUpdate.get(ticker) ?? 0;
    const lastPrices = this.lastBBO.get(ticker);
    
    // FIRST quote for this market - always allow (staggered by global rate limit)
    if (lastUpdate === 0) {
      // But still respect global rate limit to stagger initial quotes
      if (now - this.lastGlobalApiCall < this.MIN_GLOBAL_API_INTERVAL_MS) {
        return false; // Wait for global slot
      }
      this.lastGlobalApiCall = now;
      return true;
    }
    
    // GLOBAL rate limit - prevent burst of API calls across all markets
    if (now - this.lastGlobalApiCall < this.MIN_GLOBAL_API_INTERVAL_MS) {
      return false; // Too many API calls globally
    }

    // Always update if it's been a while for this specific market
    if (now - lastUpdate > this.MIN_QUOTE_INTERVAL_MS * 2) {
      this.lastGlobalApiCall = now;
      return true;
    }

    // Check time-based debounce for this market
    if (now - lastUpdate < this.MIN_QUOTE_INTERVAL_MS) {
      // Too soon - but check if price moved significantly
      if (lastPrices) {
        const bidChange = Math.abs(newBid - lastPrices.bid);
        const askChange = Math.abs(newAsk - lastPrices.ask);
        
        // Only update if price moved significantly
        if (bidChange >= this.MIN_PRICE_CHANGE || askChange >= this.MIN_PRICE_CHANGE) {
          this.lastGlobalApiCall = now;
          return true;
        }
      }
      return false; // Skip - too soon and no significant change
    }

    this.lastGlobalApiCall = now;
    return true; // Enough time has passed
  }

  /**
   * Track quote update latency
   */
  private trackLatency(ms: number): void {
    this.quoteLatencies.push(ms);
    if (this.quoteLatencies.length > this.MAX_LATENCY_SAMPLES) {
      this.quoteLatencies.shift();
    }
    
    // Warn on slow updates (with batch APIs, should be ~100-150ms)
    if (ms > 200) {
      console.warn(`[Bot] ⚠️ Slow quote update: ${ms}ms`);
    }
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(): { p50: number; p95: number; p99: number; max: number } {
    if (this.quoteLatencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, max: 0 };
    }
    
    const sorted = [...this.quoteLatencies].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)] ?? 0,
      p95: sorted[Math.floor(len * 0.95)] ?? 0,
      p99: sorted[Math.floor(len * 0.99)] ?? 0,
      max: sorted[len - 1] ?? 0,
    };
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
   * Log a fill to file (plain text + JSONL structured)
   */
  private logFillToFile(data: FillData, realizedPnL: number, sessionPnL: number): void {
    const ticker = data.market_ticker || data.ticker || "";
    const price = data.side === "yes" ? data.yes_price : data.no_price;
    const msg = `FILL: ${data.action} ${data.count}x ${data.side} ${ticker} @ ${price}¢ | Realized: ${realizedPnL}¢ | Session P&L: ${sessionPnL}¢`;
    this.logToFile(msg);

    // Structured JSONL for post-analysis
    this.logFillJsonl({
      type: "fill",
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      ticker,
      action: data.action,
      side: data.side,
      count: data.count,
      price,
      isTaker: data.is_taker ?? false,
      realizedPnL,
      sessionPnL,
      orderId: data.order_id,
    });
  }

  /**
   * Append a structured JSON line to the fills JSONL log
   */
  private logFillJsonl(record: Record<string, unknown>): void {
    try {
      appendFileSync(this.fillsLogFile, JSON.stringify(record) + "\n");
    } catch {
      // Ignore file write errors
    }
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

    console.log(`\n📈 ─── SESSION SUMMARY ────────────────────────`);
    console.log(`         Fills: ${pnl.fillsToday} | Volume: ${pnl.volumeToday} contracts`);
    console.log(`         Realized P&L: ${pnl.realizedToday > 0 ? "+" : ""}${pnl.realizedToday}¢ ($${(pnl.realizedToday / 100).toFixed(2)})`);

    if (positions.length > 0) {
      console.log("         Positions:");
      for (const pos of positions) {
        if (pos.netExposure !== 0) {
          const dir = pos.netExposure > 0 ? "LONG" : "SHORT";
          console.log(`           ${pos.ticker}: ${Math.abs(pos.netExposure)} ${dir}`);
        }
      }
    }
    console.log("─────────────────────────────────────────────────\n");

    // Log to file
    this.logToFile(`SUMMARY: Fills=${pnl.fillsToday} Vol=${pnl.volumeToday} P&L=${pnl.realizedToday}¢`);

    // Structured JSONL checkpoint
    this.logFillJsonl({
      type: "pnl_checkpoint",
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      fills: pnl.fillsToday,
      volume: pnl.volumeToday,
      realizedPnL: pnl.realizedToday,
      activeMarkets: [...this.activeMarkets],
      positions: positions.filter(p => p.netExposure !== 0).map(p => ({
        ticker: p.ticker,
        exposure: p.netExposure,
      })),
    });
  }
}

