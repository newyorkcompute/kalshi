/**
 * Inventory Tracker
 *
 * Tracks positions and PnL for market making.
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

    // Calculate position change
    const contractChange = this.calculateContractChange(fill);

    // Update contracts
    if (fill.side === "yes") {
      position.yesContracts += contractChange;
    } else {
      position.noContracts += contractChange;
    }

    // Update net exposure
    position.netExposure = position.yesContracts - position.noContracts;

    // Update cost basis and realized PnL
    const costImpact = this.calculateCostImpact(fill, position);
    position.costBasis += costImpact.costBasisChange;
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
      this.positions.set(p.ticker, {
        ticker: p.ticker,
        yesContracts: p.yesContracts,
        noContracts: p.noContracts,
        netExposure: p.yesContracts - p.noContracts,
        costBasis: p.costBasis,
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
   */
  private calculateCostImpact(
    fill: Fill,
    position: Position
  ): { costBasisChange: number; realizedPnL: number } {
    const fillCost = fill.count * fill.price;

    if (fill.action === "buy") {
      // Buying increases cost basis
      return { costBasisChange: fillCost, realizedPnL: 0 };
    } else {
      // Selling realizes PnL
      // Average cost = costBasis / total contracts
      const contracts =
        fill.side === "yes" ? position.yesContracts : position.noContracts;
      const avgCost =
        contracts > 0 ? position.costBasis / (contracts + fill.count) : 0;
      const realizedPnL = fill.count * (fill.price - avgCost);

      return {
        costBasisChange: -fill.count * avgCost,
        realizedPnL,
      };
    }
  }
}

