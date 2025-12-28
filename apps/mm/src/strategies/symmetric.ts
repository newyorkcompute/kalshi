/**
 * Symmetric Strategy
 *
 * Simple market making strategy that places symmetric quotes around mid price.
 * No inventory adjustment - quotes are always centered.
 */

import type { Quote } from "@newyorkcompute/kalshi-core";
import { BaseStrategy, type MarketSnapshot } from "./base.js";

export interface SymmetricParams {
  /** Total spread in cents (split between bid and ask) */
  spreadCents: number;
  /** Number of contracts per side */
  sizePerSide: number;
}

const DEFAULT_PARAMS: SymmetricParams = {
  spreadCents: 4,
  sizePerSide: 10,
};

/**
 * Symmetric strategy places quotes at:
 * - Bid = Mid - spread/2
 * - Ask = Mid + spread/2
 */
export class SymmetricStrategy extends BaseStrategy {
  readonly name = "symmetric";
  private params: SymmetricParams;

  constructor(params: Partial<SymmetricParams> = {}) {
    super();
    this.params = { ...DEFAULT_PARAMS, ...params };
  }

  computeQuotes(snapshot: MarketSnapshot): Quote[] {
    // Skip if not quotable
    if (!this.isQuotable(snapshot)) {
      return [];
    }

    const halfSpread = this.params.spreadCents / 2;
    const bidPrice = this.clampPrice(snapshot.mid - halfSpread);
    const askPrice = this.clampPrice(snapshot.mid + halfSpread);

    // Ensure spread is maintained
    if (askPrice <= bidPrice) {
      return [];
    }

    return [
      {
        ticker: snapshot.ticker,
        side: "yes",
        bidPrice,
        bidSize: this.params.sizePerSide,
        askPrice,
        askSize: this.params.sizePerSide,
      },
    ];
  }

  updateParams(params: Record<string, unknown>): void {
    if (typeof params.spreadCents === "number") {
      this.params.spreadCents = params.spreadCents;
    }
    if (typeof params.sizePerSide === "number") {
      this.params.sizePerSide = params.sizePerSide;
    }
  }

  getParams(): SymmetricParams {
    return { ...this.params };
  }
}

