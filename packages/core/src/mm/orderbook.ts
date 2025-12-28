/**
 * Local Orderbook
 *
 * Maintains a local copy of the orderbook from WebSocket snapshots and deltas.
 * This allows for fast quote updates without waiting for ticker messages.
 */

/** Single price level in the orderbook */
export interface PriceLevel {
  price: number;
  quantity: number;
}

/** Orderbook snapshot from WebSocket */
export interface OrderbookSnapshot {
  market_ticker: string;
  market_id: string;
  /** YES side bids: [price, quantity][] */
  yes: [number, number][];
  /** NO side bids: [price, quantity][] */
  no: [number, number][];
}

/** Orderbook delta from WebSocket */
export interface OrderbookDelta {
  market_ticker: string;
  /** Price that changed */
  price: number;
  /** New quantity (0 = level removed) */
  delta: number;
  /** Which side: 'yes' or 'no' */
  side: "yes" | "no";
}

/** Best bid/ask with size */
export interface BBO {
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  midPrice: number;
  spread: number;
}

/**
 * LocalOrderbook maintains orderbook state from WebSocket messages.
 *
 * Key insight for Kalshi:
 * - YES bids are stored in `yes` array
 * - NO bids are stored in `no` array
 * - YES ask = 100 - NO bid price
 *
 * Example: If there's a NO bid at 90¢, that's equivalent to a YES ask at 10¢
 */
export class LocalOrderbook {
  private ticker: string;
  /** YES bids: price → quantity */
  private yesBids: Map<number, number> = new Map();
  /** NO bids: price → quantity (YES asks = 100 - NO bid) */
  private noBids: Map<number, number> = new Map();
  /** Last update timestamp */
  private lastUpdate: number = 0;
  /** Sequence number for ordering */
  private sequence: number = 0;

  constructor(ticker: string) {
    this.ticker = ticker;
  }

  /**
   * Apply a full orderbook snapshot
   */
  applySnapshot(snapshot: OrderbookSnapshot): void {
    this.yesBids.clear();
    this.noBids.clear();

    // Load YES bids
    for (const [price, qty] of snapshot.yes) {
      if (qty > 0) {
        this.yesBids.set(price, qty);
      }
    }

    // Load NO bids
    for (const [price, qty] of snapshot.no) {
      if (qty > 0) {
        this.noBids.set(price, qty);
      }
    }

    this.lastUpdate = Date.now();
    this.sequence++;
  }

  /**
   * Apply an incremental delta update
   */
  applyDelta(delta: OrderbookDelta): void {
    const map = delta.side === "yes" ? this.yesBids : this.noBids;

    if (delta.delta <= 0) {
      // Remove level
      map.delete(delta.price);
    } else {
      // Update level
      map.set(delta.price, delta.delta);
    }

    this.lastUpdate = Date.now();
    this.sequence++;
  }

  /**
   * Get best bid (highest YES bid)
   */
  getBestBid(): PriceLevel | null {
    if (this.yesBids.size === 0) return null;

    let bestPrice = 0;
    let bestQty = 0;

    for (const [price, qty] of this.yesBids) {
      if (price > bestPrice && qty > 0) {
        bestPrice = price;
        bestQty = qty;
      }
    }

    return bestPrice > 0 ? { price: bestPrice, quantity: bestQty } : null;
  }

  /**
   * Get best ask (100 - highest NO bid)
   */
  getBestAsk(): PriceLevel | null {
    if (this.noBids.size === 0) return null;

    let bestNoPrice = 0;
    let bestQty = 0;

    for (const [price, qty] of this.noBids) {
      if (price > bestNoPrice && qty > 0) {
        bestNoPrice = price;
        bestQty = qty;
      }
    }

    if (bestNoPrice === 0) return null;

    // Convert NO bid to YES ask
    return { price: 100 - bestNoPrice, quantity: bestQty };
  }

  /**
   * Get best bid and offer (BBO)
   */
  getBBO(): BBO | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();

    if (!bid || !ask) return null;

    return {
      bidPrice: bid.price,
      bidSize: bid.quantity,
      askPrice: ask.price,
      askSize: ask.quantity,
      midPrice: (bid.price + ask.price) / 2,
      spread: ask.price - bid.price,
    };
  }

  /**
   * Get microprice (size-weighted mid)
   * Better estimate of "fair value" than simple mid
   *
   * microprice = (bid * askSize + ask * bidSize) / (bidSize + askSize)
   *
   * If ask size is smaller, price is closer to ask (more selling pressure)
   * If bid size is smaller, price is closer to bid (more buying pressure)
   */
  getMicroprice(): number | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();

    if (!bid || !ask) return null;

    const totalSize = bid.quantity + ask.quantity;
    if (totalSize === 0) return (bid.price + ask.price) / 2;

    return (bid.price * ask.quantity + ask.price * bid.quantity) / totalSize;
  }

  /**
   * Get depth at N levels
   */
  getDepth(levels: number = 5): { bids: PriceLevel[]; asks: PriceLevel[] } {
    // Sort bids descending (highest first)
    const sortedBids = Array.from(this.yesBids.entries())
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => b - a)
      .slice(0, levels)
      .map(([price, quantity]) => ({ price, quantity }));

    // Convert NO bids to YES asks, sort ascending (lowest first)
    const sortedAsks = Array.from(this.noBids.entries())
      .filter(([, qty]) => qty > 0)
      .map(([noPrice, quantity]) => ({ price: 100 - noPrice, quantity }))
      .sort((a, b) => a.price - b.price)
      .slice(0, levels);

    return { bids: sortedBids, asks: sortedAsks };
  }

  /**
   * Get total bid depth (sum of all bid quantities)
   */
  getTotalBidDepth(): number {
    let total = 0;
    for (const qty of this.yesBids.values()) {
      total += qty;
    }
    return total;
  }

  /**
   * Get total ask depth (sum of all ask quantities)
   */
  getTotalAskDepth(): number {
    let total = 0;
    for (const qty of this.noBids.values()) {
      total += qty;
    }
    return total;
  }

  /**
   * Get imbalance ratio: (bidDepth - askDepth) / (bidDepth + askDepth)
   * Positive = more bids (bullish), Negative = more asks (bearish)
   */
  getImbalance(): number {
    const bidDepth = this.getTotalBidDepth();
    const askDepth = this.getTotalAskDepth();
    const total = bidDepth + askDepth;

    if (total === 0) return 0;
    return (bidDepth - askDepth) / total;
  }

  /**
   * Check if orderbook is stale (no updates for X ms)
   */
  isStale(maxAgeMs: number = 5000): boolean {
    return Date.now() - this.lastUpdate > maxAgeMs;
  }

  /**
   * Get time since last update
   */
  getAge(): number {
    return Date.now() - this.lastUpdate;
  }

  /**
   * Get sequence number (for ordering/debugging)
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Get ticker
   */
  getTicker(): string {
    return this.ticker;
  }

  /**
   * Clear the orderbook
   */
  clear(): void {
    this.yesBids.clear();
    this.noBids.clear();
    this.lastUpdate = 0;
    this.sequence = 0;
  }
}

/**
 * OrderbookManager manages multiple LocalOrderbook instances
 */
export class OrderbookManager {
  private orderbooks: Map<string, LocalOrderbook> = new Map();

  /**
   * Get or create orderbook for a ticker
   */
  getOrderbook(ticker: string): LocalOrderbook {
    let ob = this.orderbooks.get(ticker);
    if (!ob) {
      ob = new LocalOrderbook(ticker);
      this.orderbooks.set(ticker, ob);
    }
    return ob;
  }

  /**
   * Apply snapshot to appropriate orderbook
   */
  applySnapshot(snapshot: OrderbookSnapshot): void {
    const ob = this.getOrderbook(snapshot.market_ticker);
    ob.applySnapshot(snapshot);
  }

  /**
   * Apply delta to appropriate orderbook
   */
  applyDelta(delta: OrderbookDelta): void {
    const ob = this.getOrderbook(delta.market_ticker);
    ob.applyDelta(delta);
  }

  /**
   * Get BBO for a ticker
   */
  getBBO(ticker: string): BBO | null {
    return this.orderbooks.get(ticker)?.getBBO() ?? null;
  }

  /**
   * Get all managed tickers
   */
  getTickers(): string[] {
    return Array.from(this.orderbooks.keys());
  }

  /**
   * Clear all orderbooks
   */
  clear(): void {
    this.orderbooks.clear();
  }
}

