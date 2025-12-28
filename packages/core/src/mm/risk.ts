/**
 * Risk Manager
 *
 * Enforces risk limits for market making.
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

/**
 * RiskManager enforces trading limits
 */
export class RiskManager {
  private limits: RiskLimits;
  private dailyPnL: number = 0;
  private halted: boolean = false;
  private haltReason?: string;

  constructor(limits: Partial<RiskLimits> = {}) {
    this.limits = { ...DEFAULT_RISK_LIMITS, ...limits };
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

    // Check position limits
    const currentPosition = Math.abs(inventory.getNetExposure(quote.ticker));
    const potentialPosition = currentPosition + Math.max(quote.bidSize, quote.askSize);
    
    if (potentialPosition > this.limits.maxPositionPerMarket) {
      return {
        allowed: false,
        reason: `Position ${potentialPosition} would exceed max ${this.limits.maxPositionPerMarket}`,
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
    if (currentPosition + order.count > this.limits.maxPositionPerMarket) {
      return {
        allowed: false,
        reason: `Would exceed position limit for ${order.ticker}`,
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

