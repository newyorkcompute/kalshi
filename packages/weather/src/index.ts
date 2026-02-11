/**
 * @newyorkcompute/kalshi-weather
 *
 * Weather intelligence for Kalshi prediction markets.
 *
 * Provides NWS forecast integration, a Gaussian probability model,
 * and fair value calculation for temperature contracts.
 *
 * @example
 * ```typescript
 * import {
 *   parseWeatherTicker,
 *   NWSClient,
 *   computeFairValue,
 *   computeLeadTimeHours,
 *   lookupCity,
 * } from "@newyorkcompute/kalshi-weather";
 *
 * const parsed = parseWeatherTicker("KXHIGHAUS-26FEB12-T85");
 * const city = lookupCity(parsed.cityCode);
 * const client = new NWSClient();
 * const forecast = await client.getDailyForecast(city, parsed.date);
 * const leadTime = computeLeadTimeHours(parsed.date);
 * const fairValue = computeFairValue(parsed, forecast, leadTime);
 *
 * console.log(`Fair value: ${fairValue.fairPriceCents}¢ (${(fairValue.probability * 100).toFixed(1)}%)`);
 * ```
 */

// Types
export type {
  CityConfig,
  TempType,
  StrikeDirection,
  ParsedTicker,
  NWSGridPoint,
  DailyForecast,
  CityForecast,
  FairValue,
  EdgeOpportunity,
} from "./types.js";

// City configuration
export {
  CITIES,
  CITY_ALIASES,
  lookupCity,
  getAllCityCodes,
} from "./cities.js";

// Ticker parsing
export {
  parseWeatherTicker,
  isWeatherTicker,
} from "./ticker-parser.js";

// Probability model
export {
  standardNormalCDF,
  probAbove,
  probBelow,
  probInRange,
  probToCents,
  getSigma,
  DEFAULT_HIGH_SIGMA,
  DEFAULT_LOW_SIGMA,
  type SigmaConfig,
} from "./probability-model.js";

// NWS API client
export { NWSClient } from "./nws-client.js";

// Fair value computation
export {
  computeFairValue,
  computeLeadTimeHours,
  type FairValueConfig,
} from "./fair-value.js";
