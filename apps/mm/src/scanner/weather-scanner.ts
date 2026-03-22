/**
 * Weather Scanner
 *
 * Specialized scanner for Kalshi weather markets (KXHIGH*, KXLOWT*).
 *
 * Unlike the general MarketScanner which scores markets by depth, spread, volume etc.,
 * the WeatherScanner is purpose-built:
 * 1. Fetches all open weather events from Kalshi
 * 2. Pairs each market with its NWS forecast (via WeatherService)
 * 3. Computes fair value + edge for each
 * 4. Returns only markets where edge exceeds threshold
 *
 * This is much simpler than the general scanner since we know exactly
 * what we're looking for and have an external fair value signal.
 */

import type { MarketApi, Market } from "kalshi-typescript";
import { GetMarketsStatusEnum } from "kalshi-typescript";
import {
  isWeatherTicker,
  parseWeatherTicker,
  type EdgeOpportunity,
} from "@newyorkcompute/kalshi-weather";
import type { WeatherService } from "../weather/weather-service.js";

export interface WeatherScannerConfig {
  /** Minimum edge in cents to include a market (default 3) */
  minEdgeCents: number;
  /** Maximum markets to track (default 50) */
  maxMarkets: number;
  /** Rescan interval in minutes (default 10) */
  rescanIntervalMin: number;
  /** Skip range bucket (B-prefix) markets entirely (default false) */
  skipRangeBuckets: boolean;
}

const DEFAULT_CONFIG: WeatherScannerConfig = {
  minEdgeCents: 3,
  maxMarkets: 50,
  rescanIntervalMin: 10,
  skipRangeBuckets: false,
};

export interface WeatherScanResult {
  /** Markets with sufficient edge */
  opportunities: EdgeOpportunity[];
  /** Total weather markets found on Kalshi */
  totalWeatherMarkets: number;
  /** Markets with valid fair values */
  marketsWithFairValue: number;
  /** Markets that passed the edge filter */
  marketsWithEdge: number;
  /** When this scan was performed */
  timestamp: Date;
}

export class WeatherScanner {
  private marketApi: MarketApi;
  private weatherService: WeatherService;
  private config: WeatherScannerConfig;

  /** Timer for periodic rescans */
  private rescanTimer: ReturnType<typeof setInterval> | null = null;

  /** Last scan result */
  private lastResult: WeatherScanResult | null = null;

  constructor(
    marketApi: MarketApi,
    weatherService: WeatherService,
    config?: Partial<WeatherScannerConfig>,
  ) {
    this.marketApi = marketApi;
    this.weatherService = weatherService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Scan for weather markets with edge opportunities.
   */
  async scan(): Promise<WeatherScanResult> {
    console.log("[WeatherScanner] Scanning for weather markets...");

    // Step 1: Fetch all open weather markets from Kalshi
    const weatherMarkets = await this.fetchWeatherMarkets();
    console.log(`[WeatherScanner] Found ${weatherMarkets.length} open weather markets`);

    // Step 2: Register tickers with the weather service so it can fetch forecasts
    for (const market of weatherMarkets) {
      if (market.ticker) {
        await this.weatherService.addTicker(market.ticker);
      }
    }

    // Step 3: Compute edge for each market
    const opportunities: EdgeOpportunity[] = [];
    let marketsWithFairValue = 0;
    let skippedRangeBuckets = 0;

    for (const market of weatherMarkets) {
      const ticker = market.ticker;
      if (!ticker) continue;

      const parsed = parseWeatherTicker(ticker, market.strike_type ?? undefined);
      if (!parsed) continue;

      // Skip range bucket markets if configured (B-prefix = "range" direction)
      if (this.config.skipRangeBuckets && parsed.direction === "range") {
        skippedRangeBuckets++;
        continue;
      }

      const fairValue = this.weatherService.getFairValue(ticker);
      if (!fairValue) continue;

      marketsWithFairValue++;

      // Get current market price (use yes_bid and yes_ask if available)
      const yesBid = market.yes_bid ?? 0;
      const yesAsk = market.yes_ask ?? 0;
      if (yesBid <= 0 && yesAsk <= 0) continue;

      const marketMid = (yesBid + yesAsk) / 2;
      if (marketMid <= 0) continue;

      // Compute edge: positive = market overpriced (sell opportunity)
      const edgeCents = marketMid - fairValue.fairPriceCents;
      const absEdge = Math.abs(edgeCents);

      if (absEdge >= this.config.minEdgeCents) {
        opportunities.push({
          ticker,
          parsed,
          fairValue,
          marketMidCents: marketMid,
          edgeCents,
          absEdgeCents: absEdge,
          action: edgeCents > 0 ? "sell" : "buy",
        });
      }
    }

    // Sort by absolute edge (descending)
    opportunities.sort((a, b) => b.absEdgeCents - a.absEdgeCents);

    // Limit to max markets
    const limited = opportunities.slice(0, this.config.maxMarkets);

    const result: WeatherScanResult = {
      opportunities: limited,
      totalWeatherMarkets: weatherMarkets.length,
      marketsWithFairValue,
      marketsWithEdge: limited.length,
      timestamp: new Date(),
    };

    this.lastResult = result;

    const skipMsg = skippedRangeBuckets > 0 ? `, ${skippedRangeBuckets} range buckets skipped` : "";
    console.log(
      `[WeatherScanner] Result: ${limited.length} markets with edge ≥ ${this.config.minEdgeCents}¢ ` +
      `(${marketsWithFairValue} with fair values, ${weatherMarkets.length} total${skipMsg})`
    );

    // Log top opportunities
    for (const opp of limited.slice(0, 5)) {
      const direction = opp.action === "sell" ? "SELL (overpriced)" : "BUY (underpriced)";
      console.log(
        `  ${opp.ticker}: market=${opp.marketMidCents.toFixed(0)}¢ model=${opp.fairValue.fairPriceCents}¢ ` +
        `edge=${opp.absEdgeCents.toFixed(1)}¢ → ${direction}`
      );
    }

    return result;
  }

  /**
   * Get recommended tickers from last scan.
   */
  getRecommendedTickers(): string[] {
    if (!this.lastResult) return [];
    return this.lastResult.opportunities.map(o => o.ticker);
  }

  /**
   * Get last scan result.
   */
  getLastResult(): WeatherScanResult | null {
    return this.lastResult;
  }

  /**
   * Start periodic rescanning.
   */
  startPeriodicScan(onComplete: (result: WeatherScanResult) => Promise<void>): void {
    if (this.rescanTimer) return;

    const intervalMs = this.config.rescanIntervalMin * 60 * 1000;
    this.rescanTimer = setInterval(async () => {
      try {
        const result = await this.scan();
        await onComplete(result);
      } catch (error) {
        console.error("[WeatherScanner] Periodic scan failed:", error);
      }
    }, intervalMs);

    console.log(`[WeatherScanner] Periodic scan started (every ${this.config.rescanIntervalMin} min)`);
  }

  /**
   * Stop periodic rescanning.
   */
  stopPeriodicScan(): void {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = null;
    }
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /**
   * Fetch all open weather markets from Kalshi.
   * Uses pagination to get all results.
   */
  private async fetchWeatherMarkets(): Promise<Market[]> {
    const allMarkets: Market[] = [];
    let cursor: string | undefined = undefined;

    // Kalshi API doesn't support direct filtering by ticker prefix,
    // so we fetch open markets and filter client-side.
    // In practice, weather markets are a small subset.
    try {
      do {
        const response = await this.marketApi.getMarkets(
          1000,          // limit (max)
          cursor,        // cursor
          undefined,     // eventTicker
          undefined,     // seriesTicker
          undefined,     // minCreatedTs
          undefined,     // maxCreatedTs
          undefined,     // maxCloseTs
          undefined,     // minCloseTs
          undefined,     // minSettledTs
          undefined,     // maxSettledTs
          GetMarketsStatusEnum.Open, // status
          undefined,     // tickers
        );

        const markets = response.data?.markets ?? [];
        const weatherBatch = markets.filter(m =>
          m.ticker && isWeatherTicker(m.ticker)
        );

        allMarkets.push(...weatherBatch);

        cursor = response.data?.cursor ?? undefined;

        // Stop if no more pages or we reached a reasonable limit
        if (!cursor || markets.length === 0 || allMarkets.length >= 500) {
          break;
        }
      } while (cursor);
    } catch (error) {
      console.error("[WeatherScanner] Failed to fetch markets:", error);
    }

    return allMarkets;
  }
}

/**
 * Format weather scan results for display.
 */
export function formatWeatherScanResults(result: WeatherScanResult): string {
  const lines = [
    `\n🌡️ ─── WEATHER SCAN RESULTS ────────────────────`,
    `  Total weather markets: ${result.totalWeatherMarkets}`,
    `  Markets with fair value: ${result.marketsWithFairValue}`,
    `  Markets with edge: ${result.marketsWithEdge}`,
    "",
  ];

  if (result.opportunities.length === 0) {
    lines.push("  No edge opportunities found.");
  } else {
    lines.push("  Top opportunities:");
    for (const opp of result.opportunities.slice(0, 10)) {
      const dir = opp.action === "sell" ? "SELL" : "BUY ";
      lines.push(
        `    ${dir} ${opp.ticker}: market=${opp.marketMidCents.toFixed(0)}¢ ` +
        `model=${opp.fairValue.fairPriceCents}¢ edge=${opp.absEdgeCents.toFixed(1)}¢ ` +
        `(P=${(opp.fairValue.probability * 100).toFixed(1)}%, σ=${opp.fairValue.sigma.toFixed(1)}°F)`
      );
    }
  }

  lines.push("──────────────────────────────────────────────────\n");
  return lines.join("\n");
}
