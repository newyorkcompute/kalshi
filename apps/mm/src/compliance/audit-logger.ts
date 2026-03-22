/**
 * Compliance Audit Logger
 *
 * Writes structured JSONL records for every compliance-relevant event:
 * quote decisions, order placements/cancellations, fills, availability
 * snapshots, config changes, and self-trade prevention events.
 *
 * Separate from the main fill log -- these records are designed for
 * regulatory inquiries and internal compliance review.
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { AuditRecord } from "@newyorkcompute/kalshi-core";

export class AuditLogger {
  private filePath: string;
  private enabled: boolean;
  private buffer: string[] = [];
  private flushIntervalMs = 5_000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logDir: string, enabled = true) {
    this.enabled = enabled;

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const date = new Date().toISOString().slice(0, 10);
    this.filePath = join(logDir, `compliance-audit-${date}.jsonl`);

    if (this.enabled) {
      this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
      // Don't keep the process alive just for flushing
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
  }

  /** Write an audit record */
  log(record: AuditRecord): void {
    if (!this.enabled) return;
    this.buffer.push(JSON.stringify(record));

    // Auto-flush if buffer is large
    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  /** Log a quote decision (strategy output before compliance) */
  logQuoteDecision(
    ticker: string,
    strategyQuotes: Array<{ bidPrice: number; askPrice: number; bidSize: number; askSize: number }>,
    isCoveredProduct: boolean,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "quote_decision",
      ticker,
      details: {
        strategyQuoteCount: strategyQuotes.length,
        isCoveredProduct,
        quotes: strategyQuotes,
      },
    });
  }

  /** Log an order placement */
  logOrderPlaced(
    ticker: string,
    side: string,
    action: string,
    price: number,
    count: number,
    clientOrderId: string,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "order_placed",
      ticker,
      details: { side, action, price, count, clientOrderId },
    });
  }

  /** Log an order cancellation */
  logOrderCancelled(
    ticker: string,
    reason: string,
    orderCount: number,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "order_cancelled",
      ticker,
      details: { reason, orderCount },
    });
  }

  /** Log a fill */
  logFill(
    ticker: string,
    side: string,
    action: string,
    price: number,
    count: number,
    realizedPnL: number,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "fill",
      ticker,
      details: { side, action, price, count, realizedPnL },
    });
  }

  /** Log a self-trade prevention event */
  logSelfTradePrevented(
    ticker: string,
    newOrderSide: string,
    newOrderPrice: number,
    restingOrderId: string,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "self_trade_prevented",
      ticker,
      details: {
        newOrderSide,
        newOrderPrice,
        restingOrderId,
      },
    });
  }

  /** Log an availability snapshot */
  logAvailabilitySnapshot(
    metrics: Array<{ product: string; availability: number; isQuoting: boolean }>,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "availability_snapshot",
      details: { products: metrics },
    });
  }

  /** Log a config change */
  logConfigChange(field: string, oldValue: unknown, newValue: unknown): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: "config_change",
      details: { field, oldValue, newValue },
    });
  }

  /** Flush buffered records to disk */
  flush(): void {
    if (this.buffer.length === 0) return;
    try {
      const data = this.buffer.join("\n") + "\n";
      appendFileSync(this.filePath, data, "utf-8");
      this.buffer = [];
    } catch (error) {
      console.error("[AuditLogger] Failed to flush:", error);
    }
  }

  /** Shut down the logger, flushing remaining records */
  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
