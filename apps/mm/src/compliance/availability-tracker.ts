/**
 * Availability Tracker
 *
 * Tracks per-product quoting uptime using rolling 1-hour windows.
 * The Kalshi Market Maker Program requires 98% availability per
 * 1-hour increment for Covered Products.
 */

import type { AvailabilityMetrics } from "@newyorkcompute/kalshi-core";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface ProductState {
  /** Start of the current 1-hour window */
  windowStart: number;
  /** Total ms with live two-sided quotes in window */
  quotingMs: number;
  /** Timestamp when quoting last started (null = not quoting) */
  quotingStartedAt: number | null;
  /** Historical completed windows for auditing */
  completedWindows: Array<{ windowStart: number; availability: number }>;
}

export class AvailabilityTracker {
  private products: Map<string, ProductState> = new Map();
  private availabilityTarget: number;

  constructor(availabilityTarget = 0.98) {
    this.availabilityTarget = availabilityTarget;
  }

  /** Mark that a product now has live two-sided quotes */
  markQuoting(ticker: string): void {
    const state = this.getOrCreate(ticker);
    this.maybeRotateWindow(state);
    if (state.quotingStartedAt === null) {
      state.quotingStartedAt = Date.now();
    }
  }

  /** Mark that a product no longer has live two-sided quotes */
  markNotQuoting(ticker: string): void {
    const state = this.products.get(ticker);
    if (!state) return;
    this.maybeRotateWindow(state);
    this.flushQuotingTime(state);
  }

  /**
   * Check if withdrawing quotes for a product would drop
   * availability below the target. Used to prevent voluntary withdrawal.
   */
  wouldBreachTarget(ticker: string): boolean {
    const state = this.products.get(ticker);
    if (!state) return false;
    this.maybeRotateWindow(state);

    const now = Date.now();
    const elapsed = now - state.windowStart;
    if (elapsed <= 0) return false;

    // Calculate current quoting time including active session
    let totalQuoting = state.quotingMs;
    if (state.quotingStartedAt !== null) {
      totalQuoting += now - state.quotingStartedAt;
    }

    // Project forward to end of window assuming we stop quoting now.
    const remainingMs = WINDOW_MS - elapsed;
    if (remainingMs <= 0) return false;

    const projectedAvailability = totalQuoting / WINDOW_MS;
    return projectedAvailability < this.availabilityTarget;
  }

  /** Get current availability metrics for a product */
  getMetrics(ticker: string): AvailabilityMetrics {
    const state = this.products.get(ticker);
    if (!state) {
      return {
        product: ticker,
        windowStart: Date.now(),
        quotingMs: 0,
        elapsedMs: 0,
        availability: 0,
        isQuoting: false,
      };
    }
    this.maybeRotateWindow(state);

    const now = Date.now();
    const elapsed = now - state.windowStart;
    let totalQuoting = state.quotingMs;
    if (state.quotingStartedAt !== null) {
      totalQuoting += now - state.quotingStartedAt;
    }

    return {
      product: ticker,
      windowStart: state.windowStart,
      quotingMs: totalQuoting,
      elapsedMs: elapsed,
      availability: elapsed > 0 ? totalQuoting / elapsed : 1,
      isQuoting: state.quotingStartedAt !== null,
    };
  }

  /** Get metrics for all tracked products */
  getAllMetrics(): AvailabilityMetrics[] {
    const results: AvailabilityMetrics[] = [];
    for (const ticker of this.products.keys()) {
      results.push(this.getMetrics(ticker));
    }
    return results;
  }

  /** Get products that are below the availability target */
  getAtRiskProducts(): AvailabilityMetrics[] {
    return this.getAllMetrics().filter(
      m => m.elapsedMs > 60_000 && m.availability < this.availabilityTarget,
    );
  }

  private getOrCreate(ticker: string): ProductState {
    let state = this.products.get(ticker);
    if (!state) {
      state = {
        windowStart: Date.now(),
        quotingMs: 0,
        quotingStartedAt: null,
        completedWindows: [],
      };
      this.products.set(ticker, state);
    }
    return state;
  }

  /** Flush accumulated quoting time from an active quoting session */
  private flushQuotingTime(state: ProductState): void {
    if (state.quotingStartedAt !== null) {
      const now = Date.now();
      state.quotingMs += now - state.quotingStartedAt;
      state.quotingStartedAt = null;
    }
  }

  /** Rotate to a new window if the current one has elapsed */
  private maybeRotateWindow(state: ProductState): void {
    const now = Date.now();
    if (now - state.windowStart < WINDOW_MS) return;

    // Flush current quoting session
    this.flushQuotingTime(state);

    // Archive completed window
    const elapsed = WINDOW_MS;
    state.completedWindows.push({
      windowStart: state.windowStart,
      availability: state.quotingMs / elapsed,
    });

    // Keep only the last 24 windows (24 hours)
    if (state.completedWindows.length > 24) {
      state.completedWindows.shift();
    }

    // Start new window
    state.windowStart = now;
    state.quotingMs = 0;
  }
}
