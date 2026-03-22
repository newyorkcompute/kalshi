/**
 * Risk Manager
 *
 * Enforces risk limits for market making.
 * Supports formal Market Maker 10x position accountability levels (Rule 4.5(a))
 * and per-contract dynamic position limits from Kalshi's API.
 */

import type {
  RiskLimits,
  RiskCheckResult,
  Quote,
  Fill,
} from "./types.js";
import type { InventoryTracker } from "./inventory.js";

/** Default risk limits (conservative) */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionPerMarket: 100,
  maxTotalExposure: 500,
  maxDailyLoss: 5000, // $50
  maxOrderSize: 25,
  minSpread: 2,
};

/** Market Maker accountability level multiplier per Rule 4.5(a) */
const MM_ACCOUNTABILITY_MULTIPLIER = 10;

/**
 * RiskManager enforces trading limits
 */
export class RiskManager {
  private limits: RiskLimits;
  private dailyPnL: number = 0;
  private halted: boolean = false;
  private haltReason?: string;

  /** Per-contract position limits fetched from Kalshi's API */
  private contractPositionLimits: Map<string, number> = new Map();
  private contractLimitCacheMs = 300_000; // 5 min TTL
  private contractLimitTimestamps: Map<string, number> = new Map();

  /** Tickers with formal MM accountability levels (10x) */
  private mmCoveredTickers: Set<string> = new Set();

  constructor(limits: Partial<RiskLimits> = {}) {
    this.limits = { ...DEFAULT_RISK_LIMITS, ...limits };
  }

  /**
   * Register tickers that have formal MM designation (10x position accountability).
   * These tickers get elevated position limits per Rule 4.5(a).
   */
  setMMCoveredTickers(tickers: string[]): void {
    this.mmCoveredTickers = new Set(tickers);
  }

  /**
   * Cache a per-contract position limit fetched from Kalshi's API.
   * The effective limit is min(config limit, API limit), unless the ticker
   * has MM accountability which applies the 10x multiplier.
   */
  setContractPositionLimit(ticker: string, limit: number): void {
    this.contractPositionLimits.set(ticker, limit);
    this.contractLimitTimestamps.set(ticker, Date.now());
  }

  /** Get the effective per-market position limit for a ticker */
  private getEffectivePositionLimit(ticker: string): number {
    let configLimit = this.limits.maxPositionPerMarket;

    // Apply 10x MM accountability multiplier for covered products.
    // Uses prefix matching to be consistent with ComplianceEnforcer.isCoveredProduct:
    // "KXBTC" in mmCoveredTickers matches "KXBTC-25MAR21-T50".
    let isCovered = false;
    for (const prefix of this.mmCoveredTickers) {
      if (ticker === prefix || ticker.startsWith(prefix)) {
        isCovered = true;
        break;
      }
    }
    if (isCovered) {
      configLimit *= MM_ACCOUNTABILITY_MULTIPLIER;
    }

    // Check cached API limit
    const apiLimit = this.contractPositionLimits.get(ticker);
    const timestamp = this.contractLimitTimestamps.get(ticker) ?? 0;
    const isFresh = Date.now() - timestamp < this.contractLimitCacheMs;

    if (apiLimit !== undefined && isFresh) {
      return Math.min(configLimit, apiLimit);
    }

    return configLimit;
  }

  /**
   * Check if a quote passes risk limits
   */
  checkQuote(quote: Quote, inventory: InventoryTracker): RiskCheckResult {
    // Check if halted
    if (this.halted) {
      return { allowed: false, reason: `Trading halted: ${this.haltReason}` };
    }

    // Check spread
    const spread = quote.askPrice - quote.bidPrice;
    if (spread < this.limits.minSpread) {
      return {
        allowed: false,
        reason: `Spread ${spread}¢ below minimum ${this.limits.minSpread}¢`,
      };
    }

    // Check order sizes
    if (quote.bidSize > this.limits.maxOrderSize) {
      return {
        allowed: false,
        reason: `Bid size ${quote.bidSize} exceeds max ${this.limits.maxOrderSize}`,
      };
    }
    if (quote.askSize > this.limits.maxOrderSize) {
      return {
        allowed: false,
        reason: `Ask size ${quote.askSize} exceeds max ${this.limits.maxOrderSize}`,
      };
    }

    // Check position limits (supports per-contract and MM accountability levels)
    const currentPosition = Math.abs(inventory.getNetExposure(quote.ticker));
    const potentialPosition = currentPosition + Math.max(quote.bidSize, quote.askSize);
    const effectiveLimit = this.getEffectivePositionLimit(quote.ticker);
    
    if (potentialPosition > effectiveLimit) {
      return {
        allowed: false,
        reason: `Position ${potentialPosition} would exceed max ${effectiveLimit} for ${quote.ticker}`,
      };
    }

    // Check total exposure
    const currentTotal = inventory.getTotalExposure();
    const potentialTotal = currentTotal + Math.max(quote.bidSize, quote.askSize);
    
    if (potentialTotal > this.limits.maxTotalExposure) {
      return {
        allowed: false,
        reason: `Total exposure ${potentialTotal} would exceed max ${this.limits.maxTotalExposure}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check a single order (simpler than quote)
   */
  checkOrder(
    order: { ticker: string; count: number },
    inventory: InventoryTracker
  ): RiskCheckResult {
    if (this.halted) {
      return { allowed: false, reason: `Trading halted: ${this.haltReason}` };
    }

    if (order.count > this.limits.maxOrderSize) {
      return {
        allowed: false,
        reason: `Order size ${order.count} exceeds max ${this.limits.maxOrderSize}`,
      };
    }

    const currentPosition = Math.abs(inventory.getNetExposure(order.ticker));
    const effectiveLimit = this.getEffectivePositionLimit(order.ticker);
    if (currentPosition + order.count > effectiveLimit) {
      return {
        allowed: false,
        reason: `Would exceed position limit (${effectiveLimit}) for ${order.ticker}`,
      };
    }

    const currentTotal = inventory.getTotalExposure();
    if (currentTotal + order.count > this.limits.maxTotalExposure) {
      return {
        allowed: false,
        reason: `Would exceed total exposure limit`,
      };
    }

    return { allowed: true };
  }

  /**
   * Update PnL on fill (checks daily loss limit)
   */
  onFill(fill: Fill, realizedPnL: number): void {
    this.dailyPnL += realizedPnL;

    // Check daily loss limit
    if (this.dailyPnL < -this.limits.maxDailyLoss) {
      this.halt(`Daily loss limit reached: ${this.dailyPnL}¢`);
    }
  }

  /**
   * Check if trading should be halted
   */
  shouldHalt(): boolean {
    return this.halted;
  }

  /**
   * Get halt reason if halted
   */
  getHaltReason(): string | undefined {
    return this.haltReason;
  }

  /**
   * Emergency halt trading
   */
  halt(reason: string): void {
    this.halted = true;
    this.haltReason = reason;
  }

  /**
   * Resume trading after halt
   */
  resume(): void {
    this.halted = false;
    this.haltReason = undefined;
  }

  /**
   * Reset daily PnL (call at start of trading day)
   */
  resetDaily(): void {
    this.dailyPnL = 0;
    // Don't auto-resume if halted for loss limit
    // Operator must explicitly resume
  }

  /**
   * Get current daily PnL
   */
  getDailyPnL(): number {
    return this.dailyPnL;
  }

  /**
   * Get current limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Update limits (for dynamic adjustment)
   */
  updateLimits(newLimits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  /**
   * Get risk status summary
   */
  getStatus(inventory: InventoryTracker): {
    halted: boolean;
    haltReason?: string;
    dailyPnL: number;
    totalExposure: number;
    utilizationPercent: number;
  } {
    const totalExposure = inventory.getTotalExposure();
    return {
      halted: this.halted,
      haltReason: this.haltReason,
      dailyPnL: this.dailyPnL,
      totalExposure,
      utilizationPercent: (totalExposure / this.limits.maxTotalExposure) * 100,
    };
  }
}

