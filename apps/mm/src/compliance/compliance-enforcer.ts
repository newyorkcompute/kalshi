/**
 * Compliance Enforcer
 *
 * Wraps strategy output to ensure formal Market Maker Program obligations
 * are met for Covered Products. The enforcer never overrides the strategy's
 * preferred side -- it only injects the missing side at minimum obligation
 * levels and clamps spreads to the max allowed.
 *
 * When the strategy returns empty quotes for a covered product during an
 * availability window, the enforcer generates minimum-obligation two-sided
 * quotes around fair value.
 */

import type {
  Quote,
  ComplianceConfig,
  LiquidityCondition,
} from "@newyorkcompute/kalshi-core";
import type { MarketSnapshot } from "../strategies/base.js";
import type { AvailabilityTracker } from "./availability-tracker.js";
import type { AuditLogger } from "./audit-logger.js";

export class ComplianceEnforcer {
  private config: ComplianceConfig;
  private coveredSet: Set<string>;
  private availabilityTracker: AvailabilityTracker | null;
  private auditLogger: AuditLogger | null;

  constructor(
    config: ComplianceConfig,
    availabilityTracker?: AvailabilityTracker,
    auditLogger?: AuditLogger,
  ) {
    this.config = config;
    this.coveredSet = new Set(config.coveredProducts);
    this.availabilityTracker = availabilityTracker ?? null;
    this.auditLogger = auditLogger ?? null;
  }

  /**
   * Check if a ticker is a Covered Product under Schedule I.
   * Supports exact ticker matches and category prefix matches (e.g. "KXBTC").
   */
  isCoveredProduct(ticker: string): boolean {
    if (!this.config.formalMarketMaker) return false;
    if (this.coveredSet.has(ticker)) return true;
    for (const prefix of this.config.coveredProducts) {
      if (ticker.startsWith(prefix)) return true;
    }
    return false;
  }

  /** Resolve the liquidity conditions for a given ticker */
  getConditions(ticker: string): LiquidityCondition {
    const lc = this.config.liquidityConditions;
    const base: LiquidityCondition = {
      maxSpreadCents: lc.defaultMaxSpreadCents,
      minSize: lc.defaultMinSize,
      availabilityTarget: lc.availabilityTarget,
    };

    // Apply per-product overrides (match by exact ticker or longest prefix)
    let bestMatch = "";
    for (const key of Object.keys(lc.perProduct)) {
      if ((ticker === key || ticker.startsWith(key)) && key.length > bestMatch.length) {
        bestMatch = key;
      }
    }
    if (bestMatch) {
      const override = lc.perProduct[bestMatch]!;
      if (override.maxSpreadCents !== undefined) base.maxSpreadCents = override.maxSpreadCents;
      if (override.minSize !== undefined) base.minSize = override.minSize;
      if (override.availabilityTarget !== undefined) base.availabilityTarget = override.availabilityTarget;
    }

    return base;
  }

  /**
   * Enforce compliance on strategy output.
   *
   * For non-covered products: pass through unchanged.
   * For covered products:
   *   - If both sides present: clamp spread to max, ensure min sizes
   *   - If one side missing: inject min-size quote on missing side
   *   - If empty quotes: generate two-sided quote at min obligation
   */
  enforce(quotes: Quote[], snapshot: MarketSnapshot): Quote[] {
    if (!this.config.formalMarketMaker) return quotes;
    if (!this.isCoveredProduct(snapshot.ticker)) return quotes;

    const conditions = this.getConditions(snapshot.ticker);
    const { bestBid, bestAsk, microprice } = snapshot;
    const mid = microprice ?? (bestBid + bestAsk) / 2;

    // If strategy gave us no quotes, generate minimum-obligation quotes
    if (quotes.length === 0) {
      const obligationQuote = this.generateObligationQuote(
        snapshot.ticker,
        mid,
        bestBid,
        bestAsk,
        conditions,
      );
      if (obligationQuote) {
        this.auditLogger?.log({
          timestamp: new Date().toISOString(),
          type: "compliance_adjustment",
          ticker: snapshot.ticker,
          details: {
            action: "generated_obligation_quote",
            reason: "strategy_returned_empty",
            bidPrice: obligationQuote.bidPrice,
            askPrice: obligationQuote.askPrice,
            bidSize: obligationQuote.bidSize,
            askSize: obligationQuote.askSize,
          },
        });
        return [obligationQuote];
      }
      return [];
    }

    // Enforce on each quote
    const enforced: Quote[] = [];
    for (const quote of quotes) {
      const adjusted = this.enforceQuote(quote, mid, bestBid, bestAsk, conditions);
      if (adjusted) {
        enforced.push(adjusted);
      }
    }

    return enforced;
  }

  /** Enforce a single quote to meet obligations */
  private enforceQuote(
    quote: Quote,
    mid: number,
    bestBid: number,
    bestAsk: number,
    conditions: LiquidityCondition,
  ): Quote | null {
    const result = { ...quote };
    let adjusted = false;

    // Ensure bid side is present with minimum size
    if (result.bidSize === 0 || result.bidPrice === 0) {
      // Strategy suppressed the bid -- inject at max spread from mid
      result.bidPrice = clampPrice(Math.floor(mid - conditions.maxSpreadCents / 2));
      result.bidSize = conditions.minSize;
      adjusted = true;
    } else if (result.bidSize < conditions.minSize) {
      result.bidSize = conditions.minSize;
      adjusted = true;
    }

    // Ensure ask side is present with minimum size
    if (result.askSize === 0 || result.askPrice === 0) {
      result.askPrice = clampPrice(Math.ceil(mid + conditions.maxSpreadCents / 2));
      result.askSize = conditions.minSize;
      adjusted = true;
    } else if (result.askSize < conditions.minSize) {
      result.askSize = conditions.minSize;
      adjusted = true;
    }

    // Clamp spread to max allowed
    const currentSpread = result.askPrice - result.bidPrice;
    if (currentSpread > conditions.maxSpreadCents) {
      // Tighten symmetrically toward mid
      const halfMax = conditions.maxSpreadCents / 2;
      result.bidPrice = clampPrice(Math.floor(mid - halfMax));
      result.askPrice = clampPrice(Math.ceil(mid + halfMax));
      adjusted = true;
    }

    // Ensure bid < ask after adjustments
    if (result.bidPrice >= result.askPrice) {
      result.bidPrice = clampPrice(result.askPrice - 1);
      if (result.bidPrice >= result.askPrice) {
        return null;
      }
    }

    if (adjusted) {
      this.auditLogger?.log({
        timestamp: new Date().toISOString(),
        type: "compliance_adjustment",
        ticker: quote.ticker,
        details: {
          action: "enforced_quote",
          original: {
            bidPrice: quote.bidPrice,
            askPrice: quote.askPrice,
            bidSize: quote.bidSize,
            askSize: quote.askSize,
          },
          adjusted: {
            bidPrice: result.bidPrice,
            askPrice: result.askPrice,
            bidSize: result.bidSize,
            askSize: result.askSize,
          },
          conditions,
        },
      });
    }

    return result;
  }

  /** Generate a minimum-obligation two-sided quote when strategy has nothing */
  private generateObligationQuote(
    ticker: string,
    mid: number,
    bestBid: number,
    bestAsk: number,
    conditions: LiquidityCondition,
  ): Quote | null {
    if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) return null;

    const halfSpread = conditions.maxSpreadCents / 2;
    const bidPrice = clampPrice(Math.floor(mid - halfSpread));
    const askPrice = clampPrice(Math.ceil(mid + halfSpread));

    if (bidPrice >= askPrice) return null;

    return {
      ticker,
      side: "yes",
      bidPrice,
      bidSize: conditions.minSize,
      askPrice,
      askSize: conditions.minSize,
    };
  }

  /** Update config at runtime (e.g. when Schedule II changes) */
  updateConfig(config: ComplianceConfig): void {
    this.config = config;
    this.coveredSet = new Set(config.coveredProducts);
  }

  /**
   * Get the minimum expiry stop-quote time for covered products.
   * For formal MM, we keep quoting much closer to expiry (60s vs 300s default).
   */
  getMinExpiryStopQuoteSec(ticker: string): number | null {
    if (!this.isCoveredProduct(ticker)) return null;
    return 60;
  }
}

function clampPrice(price: number): number {
  return Math.max(1, Math.min(99, Math.round(price)));
}
