/**
 * Self-Trade Guard
 *
 * Prevents placing a new order that would match against our own resting
 * orders on the same ticker. While Kalshi's matching engine should prevent
 * true self-trading on a single account, this guard provides defense-in-depth
 * for compliance and is essential for open-source users who might run
 * multiple instances.
 */

import type { ManagedOrder, Quote } from "@newyorkcompute/kalshi-core";
import type { AuditLogger } from "./audit-logger.js";

export class SelfTradeGuard {
  private enabled: boolean;
  private auditLogger: AuditLogger | null;

  constructor(enabled = true, auditLogger?: AuditLogger) {
    this.enabled = enabled;
    this.auditLogger = auditLogger ?? null;
  }

  /**
   * Check if a quote would cross any of our own resting orders.
   * Returns an adjusted quote that avoids self-crossing, or null
   * if the quote cannot be safely placed.
   *
   * @param quote - The quote we want to place
   * @param restingOrders - Our currently resting orders on this ticker
   */
  checkQuote(
    quote: Quote,
    restingOrders: ManagedOrder[],
  ): { safe: boolean; adjusted: Quote; cancelOrderIds: string[] } {
    if (!this.enabled) {
      return { safe: true, adjusted: quote, cancelOrderIds: [] };
    }

    const adjusted = { ...quote };
    const cancelOrderIds: string[] = [];

    const activeOrders = restingOrders.filter(
      o => o.ticker === quote.ticker && (o.status === "open" || o.status === "partial"),
    );

    for (const resting of activeOrders) {
      // Our new bid would match our resting ask (sell)
      if (
        adjusted.bidSize > 0 &&
        resting.action === "sell" &&
        adjusted.bidPrice >= resting.price
      ) {
        if (resting.id) {
          cancelOrderIds.push(resting.id);
        }
        this.auditLogger?.logSelfTradePrevented(
          quote.ticker,
          "bid",
          adjusted.bidPrice,
          resting.id ?? resting.clientOrderId,
        );
      }

      // Our new ask would match our resting bid (buy)
      if (
        adjusted.askSize > 0 &&
        resting.action === "buy" &&
        adjusted.askPrice <= resting.price
      ) {
        if (resting.id) {
          cancelOrderIds.push(resting.id);
        }
        this.auditLogger?.logSelfTradePrevented(
          quote.ticker,
          "ask",
          adjusted.askPrice,
          resting.id ?? resting.clientOrderId,
        );
      }
    }

    return {
      safe: cancelOrderIds.length === 0,
      adjusted,
      cancelOrderIds,
    };
  }
}
