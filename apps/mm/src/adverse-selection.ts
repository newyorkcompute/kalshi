/**
 * Adverse Selection Detector
 *
 * Detects when we're being "picked off" by informed traders.
 *
 * Signs of adverse selection:
 * 1. Multiple consecutive fills on the same side
 * 2. Price moves against us after fills
 * 3. Fill rate is unusually high (informed traders hitting our quotes)
 *
 * When detected, we should widen spreads or pause quoting.
 */

export interface FillRecord {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  price: number;
  timestamp: number;
}

interface MarketFillStats {
  recentFills: FillRecord[];
  consecutiveBuys: number;
  consecutiveSells: number;
  priceAtLastFill: number;
  lastFillTime: number;
  adverseScore: number;
}

export interface AdverseSelectionConfig {
  /** Window to track fills (ms) - default 60 seconds */
  windowMs: number;
  /** Consecutive fills threshold to trigger detection */
  consecutiveThreshold: number;
  /** Price move threshold (cents) after fill to consider adverse */
  priceMoveCents: number;
  /** Fill rate threshold (fills per minute) to consider unusual */
  fillRateThreshold: number;
  /** Score threshold to flag adverse selection (0-100) */
  adverseThreshold: number;
  /** Cooldown period after flagging (ms) - default 30 seconds */
  cooldownMs: number;
}

const DEFAULT_CONFIG: AdverseSelectionConfig = {
  windowMs: 60_000, // 1 minute
  consecutiveThreshold: 3, // 3 fills in same direction
  priceMoveCents: 2, // 2¢ move against us
  fillRateThreshold: 5, // 5 fills per minute is suspicious
  adverseThreshold: 50, // Score above 50 = adverse
  cooldownMs: 30_000, // 30 second cooldown
};

/**
 * Tracks adverse selection patterns per market
 */
export class AdverseSelectionDetector {
  private config: AdverseSelectionConfig;
  private marketStats: Map<string, MarketFillStats> = new Map();
  private flaggedMarkets: Map<string, number> = new Map(); // ticker → flagged until timestamp

  constructor(config: Partial<AdverseSelectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a fill for adverse selection analysis
   */
  recordFill(fill: FillRecord, currentPrice: number): void {
    let stats = this.marketStats.get(fill.ticker);

    if (!stats) {
      stats = {
        recentFills: [],
        consecutiveBuys: 0,
        consecutiveSells: 0,
        priceAtLastFill: currentPrice,
        lastFillTime: 0,
        adverseScore: 0,
      };
      this.marketStats.set(fill.ticker, stats);
    }

    // Add fill to recent list
    stats.recentFills.push(fill);
    stats.lastFillTime = fill.timestamp;

    // Prune old fills outside window
    const cutoff = Date.now() - this.config.windowMs;
    stats.recentFills = stats.recentFills.filter((f) => f.timestamp > cutoff);

    // Track consecutive fills
    if (fill.action === "buy") {
      stats.consecutiveBuys++;
      stats.consecutiveSells = 0;
    } else {
      stats.consecutiveSells++;
      stats.consecutiveBuys = 0;
    }

    // Calculate adverse score
    stats.adverseScore = this.calculateScore(fill.ticker, stats, currentPrice);

    // Flag if threshold exceeded
    if (stats.adverseScore >= this.config.adverseThreshold) {
      this.flaggedMarkets.set(
        fill.ticker,
        Date.now() + this.config.cooldownMs
      );
      console.log(
        `[AdverseSelection] ⚠️ ${fill.ticker} flagged (score=${stats.adverseScore.toFixed(0)})`
      );
    }

    // Update price reference
    stats.priceAtLastFill = currentPrice;
  }

  /**
   * Update current price for a market (call on each tick)
   */
  updatePrice(ticker: string, currentPrice: number): void {
    const stats = this.marketStats.get(ticker);
    if (!stats || stats.recentFills.length === 0) return;

    // Recalculate score with new price
    stats.adverseScore = this.calculateScore(ticker, stats, currentPrice);

    // Check if we should flag
    if (stats.adverseScore >= this.config.adverseThreshold) {
      const existing = this.flaggedMarkets.get(ticker);
      if (!existing || existing < Date.now()) {
        this.flaggedMarkets.set(
          ticker,
          Date.now() + this.config.cooldownMs
        );
        console.log(
          `[AdverseSelection] ⚠️ ${ticker} flagged on price move (score=${stats.adverseScore.toFixed(0)})`
        );
      }
    }
  }

  /**
   * Check if a market is currently flagged for adverse selection
   */
  isAdverse(ticker: string): boolean {
    const flaggedUntil = this.flaggedMarkets.get(ticker);
    if (!flaggedUntil) return false;

    if (Date.now() > flaggedUntil) {
      // Cooldown expired
      this.flaggedMarkets.delete(ticker);
      console.log(`[AdverseSelection] ✅ ${ticker} cooldown expired`);
      return false;
    }

    return true;
  }

  /**
   * Get adverse selection score for a market (0-100)
   */
  getScore(ticker: string): number {
    return this.marketStats.get(ticker)?.adverseScore ?? 0;
  }

  /**
   * Get stats for a market
   */
  getStats(ticker: string): MarketFillStats | null {
    return this.marketStats.get(ticker) ?? null;
  }

  /**
   * Get all flagged markets
   */
  getFlaggedMarkets(): string[] {
    const now = Date.now();
    const flagged: string[] = [];

    for (const [ticker, until] of this.flaggedMarkets) {
      if (now < until) {
        flagged.push(ticker);
      } else {
        this.flaggedMarkets.delete(ticker);
      }
    }

    return flagged;
  }

  /**
   * Calculate adverse selection score (0-100)
   */
  private calculateScore(
    ticker: string,
    stats: MarketFillStats,
    currentPrice: number
  ): number {
    let score = 0;

    // Factor 1: Consecutive fills (0-40 points)
    const maxConsec = Math.max(stats.consecutiveBuys, stats.consecutiveSells);
    if (maxConsec >= this.config.consecutiveThreshold) {
      score += Math.min(40, (maxConsec / this.config.consecutiveThreshold) * 20);
    }

    // Factor 2: Price moved against us after fills (0-40 points)
    if (stats.recentFills.length > 0) {
      const lastFill = stats.recentFills[stats.recentFills.length - 1]!;
      const priceMove = currentPrice - stats.priceAtLastFill;

      // If we sold and price went UP → adverse (we sold too cheap)
      // If we bought and price went DOWN → adverse (we bought too expensive)
      const adverseMove =
        (lastFill.action === "sell" && priceMove > 0) ||
        (lastFill.action === "buy" && priceMove < 0);

      if (adverseMove) {
        const moveSize = Math.abs(priceMove);
        if (moveSize >= this.config.priceMoveCents) {
          score += Math.min(40, (moveSize / this.config.priceMoveCents) * 20);
        }
      }
    }

    // Factor 3: Fill rate (0-20 points)
    const fillsInWindow = stats.recentFills.length;
    const minutesInWindow = this.config.windowMs / 60_000;
    const fillRate = fillsInWindow / minutesInWindow;

    if (fillRate >= this.config.fillRateThreshold) {
      score += Math.min(20, (fillRate / this.config.fillRateThreshold) * 10);
    }

    return Math.min(100, score);
  }

  /**
   * Reset stats for a market
   */
  reset(ticker: string): void {
    this.marketStats.delete(ticker);
    this.flaggedMarkets.delete(ticker);
  }

  /**
   * Reset all stats
   */
  resetAll(): void {
    this.marketStats.clear();
    this.flaggedMarkets.clear();
  }
}

