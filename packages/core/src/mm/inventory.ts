/**
 * Inventory Tracker
 *
 * Tracks positions and PnL for market making.
 * 
 * P&L CALCULATION MODEL:
 * - Track cost basis separately for YES and NO contracts
 * - When BUYING: Add to cost basis (you're paying to acquire)
 * - When SELLING: 
 *   - If closing existing position: Realize P&L = (sell price - avg cost) × contracts
 *   - If opening new short: Record the proceeds as "short cost basis" (what you'll need to buy back)
 * - Handle position flips (e.g., 3 LONG → sell 5 → 2 SHORT)
 */

import type { Position, Fill, PnLSummary } from "./types.js";

/**
 * InventoryTracker maintains position state for all markets
 */
export class InventoryTracker {
  private positions: Map<string, Position> = new Map();
  private realizedPnL: number = 0;
  private fillsToday: number = 0;
  private volumeToday: number = 0;

  /**
   * Update position when a fill occurs
   */
  onFill(fill: Fill): void {
    const position = this.getOrCreatePosition(fill.ticker);

    // IMPORTANT: Calculate cost impact BEFORE updating position counts
    // This is critical for correct P&L calculation
    const costImpact = this.calculateCostImpact(fill, position);

    // Calculate position change
    const contractChange = this.calculateContractChange(fill);

    // Update contracts
    if (fill.side === "yes") {
      position.yesContracts += contractChange;
      position.yesCostBasis += costImpact.costBasisChange;
    } else {
      position.noContracts += contractChange;
      position.noCostBasis += costImpact.costBasisChange;
    }

    // Update net exposure and legacy costBasis
    position.netExposure = position.yesContracts - position.noContracts;
    position.costBasis = position.yesCostBasis + position.noCostBasis;

    // Update realized P&L
    this.realizedPnL += costImpact.realizedPnL;

    // Update daily stats
    this.fillsToday++;
    this.volumeToday += fill.count;
  }

  /**
   * Get position for a specific ticker
   */
  getPosition(ticker: string): Position | undefined {
    return this.positions.get(ticker);
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get total exposure across all positions
   */
  getTotalExposure(): number {
    let total = 0;
    for (const position of this.positions.values()) {
      total += Math.abs(position.netExposure);
    }
    return total;
  }

  /**
   * Get net exposure for a specific ticker
   */
  getNetExposure(ticker: string): number {
    return this.positions.get(ticker)?.netExposure ?? 0;
  }

  /**
   * Get PnL summary
   */
  getPnLSummary(currentPrices?: Map<string, number>): PnLSummary {
    let unrealized = 0;

    // Calculate unrealized PnL if current prices provided
    if (currentPrices) {
      for (const position of this.positions.values()) {
        const price = currentPrices.get(position.ticker);
        if (price !== undefined && position.netExposure !== 0) {
          // Unrealized = (current value) - (cost basis)
          // For YES contracts: value = contracts * price
          // For NO contracts: value = contracts * (100 - price)
          const currentValue =
            position.yesContracts * price +
            position.noContracts * (100 - price);
          unrealized += currentValue - position.costBasis;
        }
      }
    }

    return {
      realizedToday: this.realizedPnL,
      unrealized,
      total: this.realizedPnL + unrealized,
      fillsToday: this.fillsToday,
      volumeToday: this.volumeToday,
    };
  }

  /**
   * Reset daily stats (call at start of trading day)
   */
  resetDaily(): void {
    this.realizedPnL = 0;
    this.fillsToday = 0;
    this.volumeToday = 0;
  }

  /**
   * Clear all positions (use with caution!)
   */
  clear(): void {
    this.positions.clear();
    this.resetDaily();
  }

  /**
   * Initialize positions from existing portfolio
   */
  initializeFromPortfolio(
    portfolioPositions: Array<{
      ticker: string;
      yesContracts: number;
      noContracts: number;
      costBasis: number;
    }>
  ): void {
    for (const p of portfolioPositions) {
      // Distribute cost basis between YES and NO based on contract counts
      // This is an approximation - we don't know the actual split from portfolio data
      const totalContracts = Math.abs(p.yesContracts) + Math.abs(p.noContracts);
      const yesFraction = totalContracts > 0 ? Math.abs(p.yesContracts) / totalContracts : 0.5;
      
      this.positions.set(p.ticker, {
        ticker: p.ticker,
        yesContracts: p.yesContracts,
        noContracts: p.noContracts,
        netExposure: p.yesContracts - p.noContracts,
        costBasis: p.costBasis,
        yesCostBasis: p.costBasis * yesFraction,
        noCostBasis: p.costBasis * (1 - yesFraction),
        unrealizedPnL: 0,
      });
    }
  }

  /**
   * Get or create position for a ticker
   */
  private getOrCreatePosition(ticker: string): Position {
    let position = this.positions.get(ticker);
    if (!position) {
      position = {
        ticker,
        yesContracts: 0,
        noContracts: 0,
        netExposure: 0,
        costBasis: 0,
        yesCostBasis: 0,
        noCostBasis: 0,
        unrealizedPnL: 0,
      };
      this.positions.set(ticker, position);
    }
    return position;
  }

  /**
   * Calculate contract change from a fill
   * Positive = adding to position, Negative = reducing position
   */
  private calculateContractChange(fill: Fill): number {
    // Buy = add contracts, Sell = remove contracts
    return fill.action === "buy" ? fill.count : -fill.count;
  }

  /**
   * Calculate cost basis change and realized PnL from a fill
   * 
   * IMPORTANT: This is called BEFORE position counts are updated!
   * 
   * Cases:
   * 1. BUY when FLAT or LONG: Add to position, increase cost basis
   * 2. BUY when SHORT: Close short position(s), realize P&L
   * 3. SELL when FLAT or SHORT: Open short position, track "short proceeds" as cost basis
   * 4. SELL when LONG: Close long position(s), realize P&L
   * 
   * Position flips are handled by splitting the fill into close + open parts.
   */
  private calculateCostImpact(
    fill: Fill,
    position: Position
  ): { costBasisChange: number; realizedPnL: number } {
    const currentContracts = fill.side === "yes" ? position.yesContracts : position.noContracts;
    const currentCostBasis = fill.side === "yes" ? position.yesCostBasis : position.noCostBasis;
    const fillValue = fill.count * fill.price;

    if (fill.action === "buy") {
      // BUYING
      if (currentContracts >= 0) {
        // Case 1: FLAT or LONG → just add to cost basis
        return { costBasisChange: fillValue, realizedPnL: 0 };
      } else {
        // Case 2: SHORT → buying closes short positions
        const shortContracts = Math.abs(currentContracts);
        const contractsToClose = Math.min(fill.count, shortContracts);
        const contractsToOpen = fill.count - contractsToClose;

        // Average "short cost" = what we received when shorting / contracts
        // When shorting, we RECEIVED money, so closing means we PAY to buy back
        // P&L = short proceeds - buy cost = (avg short price - buy price) × contracts
        const avgShortPrice = shortContracts > 0 ? currentCostBasis / shortContracts : 0;
        const realizedPnL = contractsToClose * (avgShortPrice - fill.price);

        // Cost basis change:
        // - Remove the closed portion from short cost basis
        // - Add any new long position cost basis
        const closedCostBasis = contractsToClose * avgShortPrice;
        const newLongCostBasis = contractsToOpen * fill.price;
        const costBasisChange = newLongCostBasis - closedCostBasis;

        return { costBasisChange, realizedPnL };
      }
    } else {
      // SELLING
      if (currentContracts <= 0) {
        // Case 3: FLAT or SHORT → opening/adding to short position
        // When you sell short, you receive money. Track the proceeds as "cost basis"
        // (what you'll need to pay back when you close)
        return { costBasisChange: fillValue, realizedPnL: 0 };
      } else {
        // Case 4: LONG → selling closes long positions
        const longContracts = currentContracts;
        const contractsToClose = Math.min(fill.count, longContracts);
        const contractsToOpenShort = fill.count - contractsToClose;

        // Average cost of long position
        const avgLongCost = longContracts > 0 ? currentCostBasis / longContracts : 0;
        // P&L = sell proceeds - buy cost = (sell price - avg cost) × contracts
        const realizedPnL = contractsToClose * (fill.price - avgLongCost);

        // Cost basis change:
        // - Remove the closed portion from long cost basis
        // - Add any new short position "cost basis" (the proceeds)
        const closedCostBasis = contractsToClose * avgLongCost;
        const newShortCostBasis = contractsToOpenShort * fill.price;
        const costBasisChange = newShortCostBasis - closedCostBasis;

        return { costBasisChange, realizedPnL };
      }
    }
  }
}

