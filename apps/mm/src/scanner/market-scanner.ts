/**
 * Market Scanner
 *
 * Automatically discovers profitable low-depth markets on Kalshi.
 * Scores and ranks markets by depth, category, spread, volume, and whale presence.
 *
 * Based on research findings:
 * - Low-depth markets have less competition from whales/bots
 * - Emotional categories (Sports, Entertainment, Media) have larger maker-taker gaps
 * - Markets with spreads of 3-10 cents offer the best risk/reward for makers
 * - Markets with whale orders (>2000 contracts) should be avoided
 *
 * @see GREED_BOT_ANALYSIS.md
 * @see https://www.jbecker.dev/research/prediction-market-microstructure
 */

import type { MarketApi, Market } from "kalshi-typescript";
import { GetMarketsStatusEnum } from "kalshi-typescript";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getCategoryProfile,
  getCategoryWeight,
  shouldAvoidCategory,
  type CategoryProfile,
} from "./category-weights.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScannerConfig {
  /** Maximum number of markets to select (default 50) */
  maxMarkets: number;
  /** Rescan interval in minutes (default 30) */
  rescanIntervalMin: number;
  /** Maximum total orderbook depth (default 2000) */
  maxDepth: number;
  /** Minimum recent volume to consider (default 50) */
  minVolume: number;
  /** Maximum single order size before flagging as whale (default 2000) */
  maxWhaleOrder: number;
  /** Minimum spread in cents to consider (default 2) */
  minSpread: number;
  /** Maximum spread in cents (default 25, too wide = dead) */
  maxSpread: number;
  /** Categories to prefer (empty = all except avoided) */
  preferredCategories: string[];
  /** Minimum hours until market close (default 1) */
  minHoursToExpiry: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  maxMarkets: 50,
  rescanIntervalMin: 30,
  maxDepth: 2000,
  minVolume: 50,
  maxWhaleOrder: 2000,
  minSpread: 2,
  maxSpread: 25,
  preferredCategories: [],
  minHoursToExpiry: 1,
};

export interface ScoredMarket {
  /** Market ticker */
  ticker: string;
  /** Market title */
  title: string;
  /** Event ticker (for category grouping) */
  eventTicker: string;
  /** Detected category */
  category: string;
  /** Category profitability profile */
  categoryProfile: CategoryProfile;

  // ─── Raw metrics ───
  /** Total orderbook depth (both sides) */
  totalDepth: number;
  /** Largest single order in the book */
  maxOrderSize: number;
  /** Current spread in cents */
  spread: number;
  /** Best bid price */
  yesBid: number;
  /** Best ask price */
  yesAsk: number;
  /** 24h volume */
  volume24h: number;
  /** Total volume */
  volume: number;
  /** Open interest */
  openInterest: number;
  /** Hours until close */
  hoursToClose: number;
  /** Whether market is a longshot (YES price <= 15 or >= 85) */
  isLongshot: boolean;

  // ─── Component scores (0-1) ───
  depthScore: number;
  categoryScore: number;
  spreadScore: number;
  volumeScore: number;
  whalePenalty: number;
  longshotBonus: number;

  /** Final composite score (higher = better) */
  compositeScore: number;
}

export interface ScanResult {
  /** Ranked markets (best first) */
  markets: ScoredMarket[];
  /** Total markets scanned */
  totalScanned: number;
  /** Markets rejected (too deep, dead, whale, etc.) */
  rejected: number;
  /** Scan timestamp */
  timestamp: Date;
  /** Scan duration in ms */
  durationMs: number;
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

export class MarketScanner {
  private marketApi: MarketApi;
  private config: ScannerConfig;
  private lastScanResult: ScanResult | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private cachePath: string;

  constructor(marketApi: MarketApi, config: Partial<ScannerConfig> = {}) {
    this.marketApi = marketApi;
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };

    // Set up cache file path
    const logsDir = join(process.cwd(), "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    this.cachePath = join(logsDir, "scan-cache.json");
  }

  /**
   * Run a full market scan.
   * Fetches all open markets, scores them, and returns ranked results.
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    console.log("[Scanner] Starting market scan...");

    // Step 1: Fetch all open markets (paginated)
    const allMarkets = await this.fetchAllOpenMarkets();
    console.log(`[Scanner] Fetched ${allMarkets.length} open markets`);

    // Step 2: Filter and score
    const scored: ScoredMarket[] = [];
    let rejected = 0;

    for (const market of allMarkets) {
      const result = await this.scoreMarket(market);
      if (result) {
        scored.push(result);
      } else {
        rejected++;
      }
    }

    // Step 3: Sort by composite score (descending)
    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    // Step 4: Take top N
    const selected = scored.slice(0, this.config.maxMarkets);

    const scanResult: ScanResult = {
      markets: selected,
      totalScanned: allMarkets.length,
      rejected,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };

    this.lastScanResult = scanResult;

    console.log(
      `[Scanner] Scan complete in ${scanResult.durationMs}ms: ` +
      `${selected.length} selected from ${allMarkets.length} total ` +
      `(${rejected} rejected)`
    );

    // Auto-save to cache for fast restarts
    this.saveScanCache();

    return scanResult;
  }

  /**
   * Run a scan that also fetches orderbook depth for top candidates.
   * More accurate but slower (requires per-market API calls).
   */
  async deepScan(): Promise<ScanResult> {
    const startTime = Date.now();
    console.log("[Scanner] Starting DEEP market scan (includes orderbook depth)...");

    // Step 1: Fetch all open markets
    const allMarkets = await this.fetchAllOpenMarkets();
    console.log(`[Scanner] Fetched ${allMarkets.length} open markets`);

    // Step 2: Pre-filter using market-level data only (fast)
    const candidates: Market[] = [];
    let prefilterRejected = 0;

    for (const market of allMarkets) {
      if (this.prefilterMarket(market)) {
        candidates.push(market);
      } else {
        prefilterRejected++;
      }
    }

    console.log(
      `[Scanner] Pre-filter: ${candidates.length} candidates, ${prefilterRejected} rejected`
    );

    // Step 3: Fetch orderbook depth for candidates (rate-limited)
    const scored: ScoredMarket[] = [];
    let depthRejected = 0;

    // Process in batches to respect rate limits
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1200; // ~4 req/sec to stay under 10/sec limit

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (market) => {
          const depth = await this.fetchOrderbookDepth(market.ticker);
          return { market, depth };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { market, depth } = result.value;
          const scored_market = this.scoreMarketWithDepth(market, depth);
          if (scored_market) {
            scored.push(scored_market);
          } else {
            depthRejected++;
          }
        } else {
          depthRejected++;
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < candidates.length) {
        await this.sleep(BATCH_DELAY_MS);
      }

      // Progress update
      const processed = Math.min(i + BATCH_SIZE, candidates.length);
      if (processed % 25 === 0 || processed === candidates.length) {
        console.log(`[Scanner] Deep scan progress: ${processed}/${candidates.length}`);
      }
    }

    // Step 4: Sort and select
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const selected = scored.slice(0, this.config.maxMarkets);

    const scanResult: ScanResult = {
      markets: selected,
      totalScanned: allMarkets.length,
      rejected: prefilterRejected + depthRejected,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };

    this.lastScanResult = scanResult;

    console.log(
      `[Scanner] Deep scan complete in ${(scanResult.durationMs / 1000).toFixed(1)}s: ` +
      `${selected.length} selected from ${allMarkets.length} total`
    );

    // Auto-save to cache for fast restarts
    this.saveScanCache();

    return scanResult;
  }

  /**
   * Get the last scan result (cached).
   */
  getLastScanResult(): ScanResult | null {
    return this.lastScanResult;
  }

  /**
   * Get just the tickers from the last scan.
   */
  getRecommendedTickers(): string[] {
    if (!this.lastScanResult) return [];
    return this.lastScanResult.markets.map((m) => m.ticker);
  }

  // ─── Cache Management ─────────────────────────────────────────────────────

  /**
   * Save the current scan result to disk for fast restarts.
   */
  saveScanCache(): void {
    if (!this.lastScanResult) return;
    try {
      const cacheData = {
        ...this.lastScanResult,
        timestamp: this.lastScanResult.timestamp.toISOString(),
        cachedAt: new Date().toISOString(),
      };
      writeFileSync(this.cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`[Scanner] Cache saved: ${this.lastScanResult.markets.length} markets → ${this.cachePath}`);
    } catch (error) {
      console.error("[Scanner] Failed to save cache:", error);
    }
  }

  /**
   * Load cached scan result from disk.
   * Returns null if cache doesn't exist or is too old.
   *
   * @param maxAgeMin Maximum cache age in minutes (default: rescanIntervalMin * 2)
   */
  loadScanCache(maxAgeMin?: number): ScanResult | null {
    if (!existsSync(this.cachePath)) {
      console.log("[Scanner] No cache file found");
      return null;
    }

    try {
      const raw = readFileSync(this.cachePath, "utf-8");
      const data = JSON.parse(raw);
      const cachedAt = new Date(data.cachedAt || data.timestamp);
      const ageMin = (Date.now() - cachedAt.getTime()) / 60000;
      const maxAge = maxAgeMin ?? this.config.rescanIntervalMin * 2;

      if (ageMin > maxAge) {
        console.log(`[Scanner] Cache is stale (${ageMin.toFixed(1)} min old, max ${maxAge} min)`);
        return null;
      }

      // Reconstruct ScanResult with proper Date
      const result: ScanResult = {
        markets: data.markets,
        totalScanned: data.totalScanned,
        rejected: data.rejected,
        timestamp: new Date(data.timestamp),
        durationMs: data.durationMs,
      };

      this.lastScanResult = result;
      console.log(
        `[Scanner] Cache loaded: ${result.markets.length} markets, ` +
        `${ageMin.toFixed(1)} min old`
      );
      return result;
    } catch (error) {
      console.error("[Scanner] Failed to load cache:", error);
      return null;
    }
  }

  /**
   * Smart scan: use cache if fresh, otherwise do a full scan.
   * If cache is stale but exists, returns cached result AND kicks off
   * a background refresh (via the returned Promise).
   */
  async scanWithCache(): Promise<{ result: ScanResult; fromCache: boolean; refreshing: boolean }> {
    // Try fresh cache first (within rescan interval)
    const freshCache = this.loadScanCache(this.config.rescanIntervalMin);
    if (freshCache) {
      return { result: freshCache, fromCache: true, refreshing: false };
    }

    // Try stale cache (up to 24 hours old) for immediate start
    const staleCache = this.loadScanCache(1440);
    if (staleCache) {
      console.log("[Scanner] Using stale cache for immediate start, will refresh in background");
      return { result: staleCache, fromCache: true, refreshing: true };
    }

    // No usable cache -- full scan required
    const result = await this.scan();
    this.saveScanCache();
    return { result, fromCache: false, refreshing: false };
  }

  /**
   * Start periodic scanning.
   */
  startPeriodicScan(onScanComplete?: (result: ScanResult) => void): void {
    if (this.scanTimer) return;

    const intervalMs = this.config.rescanIntervalMin * 60 * 1000;
    console.log(
      `[Scanner] Starting periodic scan every ${this.config.rescanIntervalMin} min`
    );

    this.scanTimer = setInterval(async () => {
      try {
        const result = await this.scan();
        onScanComplete?.(result);
      } catch (error) {
        console.error("[Scanner] Periodic scan failed:", error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic scanning.
   */
  stopPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      console.log("[Scanner] Periodic scan stopped");
    }
  }

  /**
   * Update scanner config at runtime.
   */
  updateConfig(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /**
   * Fetch all open markets from Kalshi with pagination.
   */
  private async fetchAllOpenMarkets(): Promise<Market[]> {
    const allMarkets: Market[] = [];
    let cursor: string | undefined;
    const limit = 1000; // Max page size
    const MAX_PAGES = 200; // Safety: cap at 200k markets to avoid infinite loops
    let page = 0;
    const seenCursors = new Set<string>();

    do {
      try {
        const response = await this.marketApi.getMarkets(
          limit,
          cursor,
          undefined, // eventTicker
          undefined, // seriesTicker
          undefined, // minCreatedTs
          undefined, // maxCreatedTs
          undefined, // maxCloseTs
          undefined, // minCloseTs
          undefined, // minSettledTs
          undefined, // maxSettledTs
          GetMarketsStatusEnum.Open, // status - only active markets
          undefined, // tickers
        );

        const markets = response.data?.markets ?? [];
        allMarkets.push(...markets);
        cursor = response.data?.cursor || undefined;
        page++;

        // Log progress every 10 pages
        if (page % 10 === 0) {
          console.log(`[Scanner] ... fetched ${allMarkets.length} markets (page ${page})`);
        }

        // Detect cursor loops
        if (cursor) {
          if (seenCursors.has(cursor)) {
            console.warn(`[Scanner] Cursor loop detected at page ${page}, stopping pagination`);
            break;
          }
          seenCursors.add(cursor);
          await this.sleep(250);
        }

        // Safety cap
        if (page >= MAX_PAGES) {
          console.warn(`[Scanner] Reached max page limit (${MAX_PAGES}), stopping`);
          break;
        }
      } catch (error) {
        console.error("[Scanner] Error fetching markets:", error);
        break;
      }
    } while (cursor);

    return allMarkets;
  }

  /**
   * Pre-filter market using only market-level data (no orderbook API call needed).
   */
  private prefilterMarket(market: Market): boolean {
    // Must be active
    if (market.status !== "active") return false;

    // Must have some volume
    if ((market.volume_24h ?? 0) < this.config.minVolume &&
        (market.volume ?? 0) < this.config.minVolume * 10) {
      return false;
    }

    // Check spread
    const bid = market.yes_bid ?? 0;
    const ask = market.yes_ask ?? 0;
    if (bid <= 0 || ask <= 0 || ask <= bid) return false;

    const spread = ask - bid;
    if (spread < this.config.minSpread || spread > this.config.maxSpread) return false;

    // Check time to expiry
    if (market.close_time) {
      const hoursToClose = (new Date(market.close_time).getTime() - Date.now()) / (3600 * 1000);
      if (hoursToClose < this.config.minHoursToExpiry) return false;
    }

    // Avoid efficient categories
    const category = market.category ?? "";
    if (shouldAvoidCategory(category, market.ticker)) return false;

    // If preferredCategories is set, only allow markets whose detected label matches
    if (this.config.preferredCategories.length > 0) {
      const profile = getCategoryProfile(category, market.ticker, market.title ?? "");
      const detectedLabel = profile.label.toLowerCase();
      const isPreferred = this.config.preferredCategories.some(
        (pref) => detectedLabel === pref.toLowerCase()
      );
      if (!isPreferred) return false;
    }

    return true;
  }

  /**
   * Score a market using only market-level data (fast scan mode).
   * Uses liquidity field as a proxy for depth since we don't fetch the orderbook.
   */
  private async scoreMarket(market: Market): Promise<ScoredMarket | null> {
    if (!this.prefilterMarket(market)) return null;

    const bid = market.yes_bid ?? 0;
    const ask = market.yes_ask ?? 0;
    const spread = ask - bid;
    const mid = (bid + ask) / 2;

    // Use liquidity as a proxy for depth (not perfect but avoids extra API calls).
    // Liquidity is in cents. Clamp to non-negative to avoid Infinity scores.
    const liquidity = Math.max(0, market.liquidity ?? 0);
    // Rough estimate: liquidity in cents / average price = approximate contracts
    const estimatedDepth = mid > 0 ? Math.max(0, liquidity / mid) : 0;

    // Check if it's a longshot market
    const isLongshot = mid <= 15 || mid >= 85;

    // Category analysis
    const category = market.category ?? "";
    const categoryProfile = getCategoryProfile(category, market.ticker, market.title);
    const categoryScore = getCategoryWeight(category, market.ticker, market.title);

    // Time to close
    const hoursToClose = market.close_time
      ? (new Date(market.close_time).getTime() - Date.now()) / (3600 * 1000)
      : 168; // Default 1 week if unknown

    // ─── Component Scores (0-1) ───

    // Depth score: lower depth = better (exponential decay)
    // 0 depth = 1.0, 1000 depth = 0.37, 2000 depth = 0.14
    const depthScore = Math.exp(-estimatedDepth / 1000);

    // Spread score: sweet spot is 3-8 cents
    // Bell curve peaking at 5 cents
    const spreadScore = Math.exp(-Math.pow((spread - 5) / 4, 2));

    // Volume score: some volume is good, but diminishing returns
    // log scale so 100 and 10000 aren't that different
    const vol = market.volume_24h ?? 0;
    const volumeScore = Math.min(1.0, Math.log10(Math.max(1, vol)) / 4);

    // Whale penalty: use open interest as a proxy (high OI = more competition)
    const oi = market.open_interest ?? 0;
    const whalePenalty = oi > 10000 ? 0.5 : oi > 5000 ? 0.3 : 0;

    // Longshot bonus: longshot markets have MUCH higher optimism tax
    // Becker (2026): 57% mispricing at 1¢ vs 2.66% at 50¢ — tails are 20x more profitable
    const longshotBonus = isLongshot ? 0.30 : 0;

    // ─── Composite Score ───
    // Weighted combination — longshot bonus doubled to prioritize tail markets
    // where maker edge is strongest per Becker's research
    const compositeScore =
      depthScore * 0.25 +          // 25% - Low depth is important
      categoryScore * 0.20 +       // 20% - Category matters (emotional > efficient)
      spreadScore * 0.10 +         // 10% - Good spread
      volumeScore * 0.15 +         // 15% - Some volume needed for fills
      longshotBonus * 0.30 -       // 30% - Longshot bonus (biggest edge per research)
      whalePenalty;                 // Penalty for whale markets

    return {
      ticker: market.ticker,
      title: market.title ?? "",
      eventTicker: market.event_ticker ?? "",
      category: categoryProfile.label,
      categoryProfile,
      totalDepth: Math.round(estimatedDepth),
      maxOrderSize: 0, // Unknown without orderbook
      spread,
      yesBid: bid,
      yesAsk: ask,
      volume24h: market.volume_24h ?? 0,
      volume: market.volume ?? 0,
      openInterest: market.open_interest ?? 0,
      hoursToClose: Math.round(hoursToClose * 10) / 10,
      isLongshot,
      depthScore,
      categoryScore,
      spreadScore,
      volumeScore,
      whalePenalty,
      longshotBonus,
      compositeScore,
    };
  }

  /**
   * Fetch orderbook depth for a specific market.
   */
  private async fetchOrderbookDepth(
    ticker: string
  ): Promise<{ totalDepth: number; maxOrderSize: number; levels: number }> {
    try {
      const response = await this.marketApi.getMarketOrderbook(ticker);
      const orderbook = response.data?.orderbook;

      if (!orderbook) {
        return { totalDepth: 0, maxOrderSize: 0, levels: 0 };
      }

      let totalDepth = 0;
      let maxOrderSize = 0;
      let levels = 0;

      // 'true' = YES side, 'false' = NO side
      // Each entry is [price, quantity]
      const yesSide = orderbook["true"] ?? [];
      const noSide = orderbook["false"] ?? [];

      for (const level of yesSide) {
        if (Array.isArray(level) && level.length >= 2) {
          const qty = level[1] ?? 0;
          totalDepth += qty;
          maxOrderSize = Math.max(maxOrderSize, qty);
          levels++;
        }
      }

      for (const level of noSide) {
        if (Array.isArray(level) && level.length >= 2) {
          const qty = level[1] ?? 0;
          totalDepth += qty;
          maxOrderSize = Math.max(maxOrderSize, qty);
          levels++;
        }
      }

      return { totalDepth, maxOrderSize, levels };
    } catch {
      return { totalDepth: 0, maxOrderSize: 0, levels: 0 };
    }
  }

  /**
   * Score a market with actual orderbook depth data (deep scan mode).
   */
  private scoreMarketWithDepth(
    market: Market,
    depth: { totalDepth: number; maxOrderSize: number; levels: number },
  ): ScoredMarket | null {
    // Reject if depth exceeds limit
    if (depth.totalDepth > this.config.maxDepth) return null;

    // Reject whale markets
    if (depth.maxOrderSize > this.config.maxWhaleOrder) return null;

    const bid = market.yes_bid ?? 0;
    const ask = market.yes_ask ?? 0;
    if (bid <= 0 || ask <= 0 || ask <= bid) return null;

    const spread = ask - bid;
    if (spread < this.config.minSpread || spread > this.config.maxSpread) return null;

    const mid = (bid + ask) / 2;
    const isLongshot = mid <= 15 || mid >= 85;

    // Category
    const category = market.category ?? "";
    if (shouldAvoidCategory(category, market.ticker)) return null;

    const categoryProfile = getCategoryProfile(category, market.ticker, market.title);
    const categoryScore = getCategoryWeight(category, market.ticker, market.title);

    // Time to close
    const hoursToClose = market.close_time
      ? (new Date(market.close_time).getTime() - Date.now()) / (3600 * 1000)
      : 168;

    if (hoursToClose < this.config.minHoursToExpiry) return null;

    // ─── Component Scores (0-1) ───

    // Depth score: exponential decay, sharper than fast scan since we have real data
    const depthScore = Math.exp(-depth.totalDepth / 800);

    // Spread score: sweet spot 3-8 cents
    const spreadScore = Math.exp(-Math.pow((spread - 5) / 4, 2));

    // Volume score
    const vol = market.volume_24h ?? 0;
    const volumeScore = Math.min(1.0, Math.log10(Math.max(1, vol)) / 4);

    // Whale penalty: based on actual max order size
    const whalePenalty =
      depth.maxOrderSize > 5000 ? 0.6 :
      depth.maxOrderSize > 2000 ? 0.4 :
      depth.maxOrderSize > 1000 ? 0.2 :
      depth.maxOrderSize > 500 ? 0.1 : 0;

    // Longshot bonus: tails are 20x more profitable per Becker (2026)
    const longshotBonus = isLongshot ? 0.30 : 0;

    // Composite score — matches fast scan weights
    const compositeScore =
      depthScore * 0.25 +
      categoryScore * 0.20 +
      spreadScore * 0.10 +
      volumeScore * 0.15 +
      longshotBonus * 0.30 -
      whalePenalty;

    return {
      ticker: market.ticker,
      title: market.title ?? "",
      eventTicker: market.event_ticker ?? "",
      category: categoryProfile.label,
      categoryProfile,
      totalDepth: depth.totalDepth,
      maxOrderSize: depth.maxOrderSize,
      spread,
      yesBid: bid,
      yesAsk: ask,
      volume24h: market.volume_24h ?? 0,
      volume: market.volume ?? 0,
      openInterest: market.open_interest ?? 0,
      hoursToClose: Math.round(hoursToClose * 10) / 10,
      isLongshot,
      depthScore,
      categoryScore,
      spreadScore,
      volumeScore,
      whalePenalty,
      longshotBonus,
      compositeScore,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Format scan results for console output.
 */
export function formatScanResults(result: ScanResult): string {
  const lines: string[] = [];

  lines.push("╔═══════════════════════════════════════════════════════════════════╗");
  lines.push("║                    Market Scanner Results                        ║");
  lines.push("╚═══════════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`  Scanned: ${result.totalScanned} markets`);
  lines.push(`  Selected: ${result.markets.length} | Rejected: ${result.rejected}`);
  lines.push(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push(`  Time: ${result.timestamp.toLocaleString()}`);
  lines.push("");
  lines.push("  ───────────────────────────────────────────────────────────────");
  lines.push(
    "  #   Score  Ticker                          Spread  Depth   Category     Longshot"
  );
  lines.push("  ───────────────────────────────────────────────────────────────");

  for (let i = 0; i < result.markets.length; i++) {
    const m = result.markets[i];
    const rank = String(i + 1).padStart(3);
    const score = m.compositeScore.toFixed(3).padStart(6);
    const ticker = m.ticker.padEnd(30).slice(0, 30);
    const spread = `${m.spread}c`.padStart(5);
    const depth = String(m.totalDepth).padStart(6);
    const cat = m.category.padEnd(12).slice(0, 12);
    const longshot = m.isLongshot ? "  YES" : "   --";

    lines.push(`  ${rank}  ${score}  ${ticker}  ${spread}  ${depth}  ${cat}  ${longshot}`);
  }

  lines.push("  ───────────────────────────────────────────────────────────────");

  // Category breakdown
  const categoryCounts = new Map<string, number>();
  for (const m of result.markets) {
    categoryCounts.set(m.category, (categoryCounts.get(m.category) ?? 0) + 1);
  }
  lines.push("");
  lines.push("  Category breakdown:");
  for (const [cat, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`    ${cat}: ${count} markets`);
  }

  return lines.join("\n");
}
