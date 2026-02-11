/**
 * NWS API Client
 *
 * Fetches weather forecasts from the National Weather Service API (api.weather.gov).
 *
 * The NWS API is free, requires no API key, and provides official forecast data.
 * Only requirement: a User-Agent header identifying the application.
 *
 * Workflow:
 * 1. /points/{lat},{lon} → grid metadata (WFO, grid coordinates) — cached forever
 * 2. /gridpoints/{wfo}/{x},{y}/forecast → daily forecast (high/low) — cached 1 hour
 *
 * @see https://weather-gov.github.io/api/general-faqs
 */

import type { CityConfig, NWSGridPoint, DailyForecast, CityForecast } from "./types.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const NWS_BASE_URL = "https://api.weather.gov";
const USER_AGENT = "KalshiWeatherBot/1.0 (newyorkcompute; weather-market-maker)";

/** How long to cache forecast data (ms) */
const FORECAST_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Max retries for transient errors */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 1000;

// ─── NWS API Response Types ─────────────────────────────────────────────────

interface NWSPointsResponse {
  properties: {
    gridId: string;   // WFO identifier (e.g., "EWX")
    gridX: number;
    gridY: number;
    forecast: string; // URL for daily forecast
    forecastHourly: string; // URL for hourly forecast
  };
}

interface NWSForecastPeriod {
  number: number;
  name: string;        // e.g., "Today", "Tonight", "Wednesday"
  startTime: string;   // ISO 8601
  endTime: string;     // ISO 8601
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string; // "F" or "C"
}

interface NWSForecastResponse {
  properties: {
    periods: NWSForecastPeriod[];
    updateTime: string;
  };
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class NWSClient {
  /** Grid point cache: cityCode → NWSGridPoint (cached forever) */
  private gridPointCache: Map<string, NWSGridPoint> = new Map();

  /** Forecast cache: cityCode → CityForecast */
  private forecastCache: Map<string, CityForecast> = new Map();

  /** Custom User-Agent */
  private userAgent: string;

  constructor(userAgent?: string) {
    this.userAgent = userAgent ?? USER_AGENT;
  }

  /**
   * Get the daily forecast for a city.
   * Returns cached data if still fresh, otherwise fetches from NWS.
   */
  async getForecast(city: CityConfig): Promise<CityForecast> {
    const cached = this.forecastCache.get(city.kalshiCode);
    if (cached && !this.isCacheStale(cached)) {
      return cached;
    }

    // Ensure we have grid point data
    const gridPoint = await this.getGridPoint(city);

    // Fetch forecast
    const forecasts = await this.fetchForecast(gridPoint);

    const cityForecast: CityForecast = {
      city,
      dailyForecasts: forecasts,
      lastRefreshed: new Date(),
    };

    this.forecastCache.set(city.kalshiCode, cityForecast);
    return cityForecast;
  }

  /**
   * Get a specific day's forecast for a city.
   */
  async getDailyForecast(city: CityConfig, date: string): Promise<DailyForecast | null> {
    const cityForecast = await this.getForecast(city);
    return cityForecast.dailyForecasts.get(date) ?? null;
  }

  /**
   * Force refresh forecasts for a city (bypasses cache).
   */
  async refreshForecast(city: CityConfig): Promise<CityForecast> {
    this.forecastCache.delete(city.kalshiCode);
    return this.getForecast(city);
  }

  /**
   * Get grid point metadata for a city.
   * Cached forever (grid points don't change).
   */
  async getGridPoint(city: CityConfig): Promise<NWSGridPoint> {
    const cached = this.gridPointCache.get(city.kalshiCode);
    if (cached) return cached;

    const url = `${NWS_BASE_URL}/points/${city.lat.toFixed(4)},${city.lon.toFixed(4)}`;
    const data = await this.fetchJson<NWSPointsResponse>(url);

    const gridPoint: NWSGridPoint = {
      wfo: data.properties.gridId,
      gridX: data.properties.gridX,
      gridY: data.properties.gridY,
      forecastUrl: data.properties.forecast,
      forecastHourlyUrl: data.properties.forecastHourly,
    };

    this.gridPointCache.set(city.kalshiCode, gridPoint);
    return gridPoint;
  }

  /**
   * Clear all caches.
   */
  clearCache(): void {
    this.gridPointCache.clear();
    this.forecastCache.clear();
  }

  /**
   * Get cache status for monitoring.
   */
  getCacheStatus(): { gridPoints: number; forecasts: number; stale: string[] } {
    const stale: string[] = [];
    for (const [code, forecast] of this.forecastCache) {
      if (this.isCacheStale(forecast)) {
        stale.push(code);
      }
    }
    return {
      gridPoints: this.gridPointCache.size,
      forecasts: this.forecastCache.size,
      stale,
    };
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private isCacheStale(forecast: CityForecast): boolean {
    return Date.now() - forecast.lastRefreshed.getTime() > FORECAST_CACHE_TTL_MS;
  }

  /**
   * Fetch and parse daily forecast from NWS.
   * Extracts high and low temperatures for each day.
   */
  private async fetchForecast(gridPoint: NWSGridPoint): Promise<Map<string, DailyForecast>> {
    const data = await this.fetchJson<NWSForecastResponse>(gridPoint.forecastUrl);
    const periods = data.properties.periods;
    const now = new Date();

    // NWS forecast periods alternate: daytime (high) and nighttime (low)
    // We pair them up by date to get high/low for each day.
    const dayMap = new Map<string, { high?: number; low?: number }>();

    for (const period of periods) {
      const date = period.startTime.split("T")[0]; // Extract YYYY-MM-DD
      if (!date) continue;

      // Convert to Fahrenheit if needed
      let tempF = period.temperature;
      if (period.temperatureUnit === "C") {
        tempF = tempF * 9 / 5 + 32;
      }

      const entry = dayMap.get(date) ?? {};

      if (period.isDaytime) {
        entry.high = tempF;
      } else {
        entry.low = tempF;
      }

      dayMap.set(date, entry);
    }

    // Build DailyForecast map
    const forecasts = new Map<string, DailyForecast>();

    for (const [date, temps] of dayMap) {
      // Only include days where we have at least high or low
      if (temps.high === undefined && temps.low === undefined) continue;

      forecasts.set(date, {
        date,
        highF: temps.high ?? temps.low! + 15, // Rough estimate if missing
        lowF: temps.low ?? temps.high! - 15,  // Rough estimate if missing
        fetchedAt: now,
      });
    }

    return forecasts;
  }

  /**
   * Fetch JSON from a URL with retry logic and proper headers.
   */
  private async fetchJson<T>(url: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            "Accept": "application/geo+json",
          },
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");

          // Rate limited — retry with backoff
          if (response.status === 429 || response.status === 503) {
            if (attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt);
              console.warn(
                `[NWSClient] ${response.status} on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
              );
              await this.sleep(delay);
              continue;
            }
          }

          throw new Error(
            `NWS API error ${response.status}: ${response.statusText}. URL: ${url}. Body: ${body.slice(0, 200)}`,
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Retry on network errors
        if (attempt < MAX_RETRIES && this.isTransientError(lastError)) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[NWSClient] Network error on ${url}: ${lastError.message}. Retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error("NWS fetch failed after retries");
  }

  private isTransientError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("socket hang up") ||
      msg.includes("network") ||
      msg.includes("fetch failed")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
