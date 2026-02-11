/**
 * Weather Intelligence Types
 *
 * Shared types for the weather probability model and NWS integration.
 */

// ─── City Configuration ─────────────────────────────────────────────────────

/** Configuration for a city tracked by Kalshi weather markets */
export interface CityConfig {
  /** Kalshi ticker code (e.g., "AUS", "CHI", "NY") */
  kalshiCode: string;
  /** Full city name */
  name: string;
  /** NWS weather station ID (e.g., "KAUS", "KMDW", "KLGA") */
  nwsStation: string;
  /** Latitude (decimal degrees) */
  lat: number;
  /** Longitude (decimal degrees) */
  lon: number;
}

// ─── Parsed Ticker ──────────────────────────────────────────────────────────

/** Market type: high or low temperature */
export type TempType = "high" | "low";

/**
 * Strike direction in a weather market:
 * - "above": Will temp be ABOVE strike? (e.g., T85 = ">85°")
 * - "below": Will temp be BELOW strike? (e.g., T72 with "less" = "<72°")
 * - "range": Will temp be in a 2-degree bucket? (e.g., B82.5 = "82-83°")
 */
export type StrikeDirection = "above" | "below" | "range";

/** Parsed Kalshi weather ticker */
export interface ParsedTicker {
  /** Original full ticker */
  ticker: string;
  /** High or low temperature market */
  tempType: TempType;
  /** Kalshi city code (e.g., "AUS", "CHI") */
  cityCode: string;
  /** Target date (YYYY-MM-DD) */
  date: string;
  /** Strike temperature in Fahrenheit */
  strike: number;
  /** Direction of the bet */
  direction: StrikeDirection;
  /**
   * For "range" markets, the range bounds.
   * E.g., B82.5 → rangeLow=82, rangeHigh=83
   */
  rangeLow?: number;
  rangeHigh?: number;
}

// ─── NWS Forecast ───────────────────────────────────────────────────────────

/** NWS grid point metadata (cached from /points/{lat},{lon}) */
export interface NWSGridPoint {
  /** Weather Forecast Office ID (e.g., "EWX", "LOT") */
  wfo: string;
  /** Grid X coordinate */
  gridX: number;
  /** Grid Y coordinate */
  gridY: number;
  /** Forecast URL */
  forecastUrl: string;
  /** Hourly forecast URL */
  forecastHourlyUrl: string;
}

/** Daily temperature forecast for a single day */
export interface DailyForecast {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Forecasted high temperature (Fahrenheit) */
  highF: number;
  /** Forecasted low temperature (Fahrenheit) */
  lowF: number;
  /** When this forecast was fetched */
  fetchedAt: Date;
}

/** Forecast collection for a city */
export interface CityForecast {
  /** City configuration */
  city: CityConfig;
  /** Daily forecasts (keyed by date YYYY-MM-DD) */
  dailyForecasts: Map<string, DailyForecast>;
  /** When forecasts were last refreshed from NWS */
  lastRefreshed: Date;
}

// ─── Fair Value ─────────────────────────────────────────────────────────────

/** Computed fair value for a weather market */
export interface FairValue {
  /** Market ticker */
  ticker: string;
  /** Model probability (0-1) */
  probability: number;
  /** Fair price in cents (1-99) */
  fairPriceCents: number;
  /** NWS forecast used */
  forecastTemp: number;
  /** Sigma (forecast uncertainty) used */
  sigma: number;
  /** Lead time in hours */
  leadTimeHours: number;
  /** When this was computed */
  computedAt: Date;
}

/** Edge opportunity — a market where model disagrees with market price */
export interface EdgeOpportunity {
  /** Market ticker */
  ticker: string;
  /** Parsed ticker data */
  parsed: ParsedTicker;
  /** Model fair value */
  fairValue: FairValue;
  /** Current market mid price (cents) */
  marketMidCents: number;
  /** Edge in cents (positive = overpriced by market, negative = underpriced) */
  edgeCents: number;
  /** Absolute edge in cents */
  absEdgeCents: number;
  /** Recommended action: "sell" if overpriced, "buy" if underpriced */
  action: "buy" | "sell";
}
