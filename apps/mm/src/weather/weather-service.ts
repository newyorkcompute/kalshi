/**
 * Weather Service
 *
 * Orchestrator that manages NWS forecasts and fair value computation
 * for all active weather markets. Maintains a live cache of fair values
 * that the WeatherInformedStrategy can query on each tick.
 *
 * Responsibilities:
 * 1. Periodically refresh NWS forecasts (default every 30 min)
 * 2. Map each weather ticker → city → forecast → fair value
 * 3. Expose getFairValue(ticker) for the strategy
 * 4. Log model predictions for future calibration
 */

import {
  NWSClient,
  parseWeatherTicker,
  isWeatherTicker,
  lookupCity,
  computeFairValue,
  computeLeadTimeHours,
  type FairValue,
  type CityConfig,
  type FairValueConfig,
} from "@newyorkcompute/kalshi-weather";

export interface WeatherServiceConfig {
  /** How often to refresh NWS data (minutes). Default 30. */
  refreshIntervalMin: number;
  /** Sigma overrides for calibration */
  fairValueConfig?: FairValueConfig;
}

const DEFAULT_CONFIG: WeatherServiceConfig = {
  refreshIntervalMin: 30,
};

export class WeatherService {
  private nws: NWSClient;
  private config: WeatherServiceConfig;

  /** ticker → FairValue (live cache) */
  private fairValues: Map<string, FairValue> = new Map();

  /** Set of city codes we've seen in active markets */
  private activeCities: Set<string> = new Set();

  /** Refresh timer handle */
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether initial load has completed */
  private initialized = false;

  constructor(config?: Partial<WeatherServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nws = new NWSClient();
  }

  /**
   * Initialize the service with a set of weather tickers.
   * Fetches initial forecasts for all cities and computes fair values.
   */
  async initialize(tickers: string[]): Promise<void> {
    console.log(`[WeatherService] Initializing with ${tickers.length} tickers...`);

    // Parse tickers and identify unique cities
    const tickerMap = new Map<string, ReturnType<typeof parseWeatherTicker>>();
    for (const ticker of tickers) {
      if (!isWeatherTicker(ticker)) continue;
      const parsed = parseWeatherTicker(ticker);
      if (parsed) {
        tickerMap.set(ticker, parsed);
        this.activeCities.add(parsed.cityCode);
      }
    }

    console.log(`[WeatherService] ${tickerMap.size} weather tickers across ${this.activeCities.size} cities`);

    // Fetch forecasts for all active cities
    await this.refreshForecasts();

    // Compute initial fair values
    for (const [ticker, parsed] of tickerMap) {
      if (!parsed) continue;
      await this.computeAndCacheFairValue(ticker, parsed);
    }

    console.log(`[WeatherService] Computed ${this.fairValues.size} fair values`);
    this.initialized = true;

    // Start periodic refresh
    this.startRefreshLoop();
  }

  /**
   * Get the model fair value for a ticker.
   * Returns null if no fair value is available (non-weather ticker, missing forecast, etc.)
   */
  getFairValue(ticker: string): FairValue | null {
    return this.fairValues.get(ticker) ?? null;
  }

  /**
   * Get the fair price in cents for a ticker, or null.
   */
  getFairPriceCents(ticker: string): number | null {
    const fv = this.fairValues.get(ticker);
    return fv?.fairPriceCents ?? null;
  }

  /**
   * Update fair value for a single ticker.
   * Called when a new weather market is added dynamically.
   */
  async addTicker(ticker: string): Promise<void> {
    if (!isWeatherTicker(ticker)) return;
    const parsed = parseWeatherTicker(ticker);
    if (!parsed) return;

    this.activeCities.add(parsed.cityCode);
    await this.computeAndCacheFairValue(ticker, parsed);
  }

  /**
   * Remove a ticker from tracking.
   */
  removeTicker(ticker: string): void {
    this.fairValues.delete(ticker);
  }

  /**
   * Get all current fair values (for monitoring/logging).
   */
  getAllFairValues(): Map<string, FairValue> {
    return new Map(this.fairValues);
  }

  /**
   * Force a refresh of all forecasts and fair values.
   */
  async refresh(): Promise<void> {
    await this.refreshForecasts();
    await this.recomputeAllFairValues();
  }

  /**
   * Stop the service (clear refresh timer).
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    console.log("[WeatherService] Stopped");
  }

  /**
   * Whether the service has completed initial loading.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get cache/service status for monitoring.
   */
  getStatus(): {
    initialized: boolean;
    fairValueCount: number;
    activeCities: number;
    nwsCacheStatus: ReturnType<NWSClient["getCacheStatus"]>;
  } {
    return {
      initialized: this.initialized,
      fairValueCount: this.fairValues.size,
      activeCities: this.activeCities.size,
      nwsCacheStatus: this.nws.getCacheStatus(),
    };
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private startRefreshLoop(): void {
    if (this.refreshTimer) return;

    const intervalMs = this.config.refreshIntervalMin * 60 * 1000;
    this.refreshTimer = setInterval(async () => {
      try {
        console.log("[WeatherService] Periodic refresh starting...");
        await this.refresh();
        console.log(`[WeatherService] Refreshed ${this.fairValues.size} fair values`);
      } catch (error) {
        console.error("[WeatherService] Refresh failed:", error);
      }
    }, intervalMs);

    console.log(`[WeatherService] Refresh loop started (every ${this.config.refreshIntervalMin} min)`);
  }

  private async refreshForecasts(): Promise<void> {
    const cities = Array.from(this.activeCities);
    let successes = 0;
    let failures = 0;

    for (const cityCode of cities) {
      const city = lookupCity(cityCode);
      if (!city) continue;

      try {
        await this.nws.getForecast(city);
        successes++;
      } catch (error) {
        console.error(`[WeatherService] Failed to fetch forecast for ${cityCode}:`, error);
        failures++;
      }
    }

    console.log(`[WeatherService] Forecast refresh: ${successes} ok, ${failures} failed`);
  }

  private async recomputeAllFairValues(): Promise<void> {
    const tickers = Array.from(this.fairValues.keys());
    for (const ticker of tickers) {
      const parsed = parseWeatherTicker(ticker);
      if (parsed) {
        await this.computeAndCacheFairValue(ticker, parsed);
      }
    }
  }

  private async computeAndCacheFairValue(
    ticker: string,
    parsed: NonNullable<ReturnType<typeof parseWeatherTicker>>,
  ): Promise<void> {
    const city: CityConfig | null = lookupCity(parsed.cityCode);
    if (!city) return;

    try {
      const forecast = await this.nws.getDailyForecast(city, parsed.date);
      if (!forecast) {
        // No forecast available for this date (might be too far ahead)
        return;
      }

      const leadTimeHours = computeLeadTimeHours(parsed.date);
      const fairValue = computeFairValue(
        parsed,
        forecast,
        leadTimeHours,
        this.config.fairValueConfig,
      );

      this.fairValues.set(ticker, fairValue);
    } catch (error) {
      console.error(`[WeatherService] Failed to compute fair value for ${ticker}:`, error);
    }
  }
}
