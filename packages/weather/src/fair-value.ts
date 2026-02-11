/**
 * Fair Value Calculator
 *
 * Orchestrates the ticker parser, probability model, and forecast data
 * to compute fair values for Kalshi weather contracts.
 *
 * This is the main entry point for the weather intelligence system.
 */

import type { ParsedTicker, DailyForecast, FairValue } from "./types.js";
import {
  probAbove,
  probBelow,
  probInRange,
  probToCents,
  getSigma,
  DEFAULT_HIGH_SIGMA,
  DEFAULT_LOW_SIGMA,
  type SigmaConfig,
} from "./probability-model.js";

export interface FairValueConfig {
  /** Override sigma config for high temps */
  highSigma?: Partial<SigmaConfig>;
  /** Override sigma config for low temps */
  lowSigma?: Partial<SigmaConfig>;
}

/**
 * Compute the fair value of a weather contract.
 *
 * @param parsed - Parsed ticker data
 * @param forecast - NWS daily forecast for the target date
 * @param leadTimeHours - Hours until the market settles
 * @param config - Optional sigma overrides
 * @returns Fair value with probability, price, and metadata
 */
export function computeFairValue(
  parsed: ParsedTicker,
  forecast: DailyForecast,
  leadTimeHours: number,
  config?: FairValueConfig,
): FairValue {
  // Get the relevant forecast temperature
  const forecastTemp = parsed.tempType === "high" ? forecast.highF : forecast.lowF;

  // Get sigma for this lead time and temp type
  const sigmaConfig = parsed.tempType === "high"
    ? { ...DEFAULT_HIGH_SIGMA, ...config?.highSigma }
    : { ...DEFAULT_LOW_SIGMA, ...config?.lowSigma };
  const sigma = getSigma(leadTimeHours, sigmaConfig);

  // Compute probability based on direction
  let probability: number;

  switch (parsed.direction) {
    case "above":
      probability = probAbove(forecastTemp, parsed.strike, sigma);
      break;
    case "below":
      probability = probBelow(forecastTemp, parsed.strike, sigma);
      break;
    case "range":
      if (parsed.rangeLow !== undefined && parsed.rangeHigh !== undefined) {
        probability = probInRange(forecastTemp, parsed.rangeLow, parsed.rangeHigh, sigma);
      } else {
        // Fallback: use a 2-degree range centered on strike
        probability = probInRange(forecastTemp, parsed.strike - 0.5, parsed.strike + 0.5, sigma);
      }
      break;
  }

  return {
    ticker: parsed.ticker,
    probability,
    fairPriceCents: probToCents(probability),
    forecastTemp,
    sigma,
    leadTimeHours,
    computedAt: new Date(),
  };
}

/**
 * Compute lead time in hours from now to market settlement.
 *
 * Weather markets typically settle at a fixed time after the target date.
 * Kalshi settles the next morning (roughly 10:00 AM ET, which is ~15:00 UTC).
 *
 * @param targetDate - Target date string (YYYY-MM-DD)
 * @param now - Current time (defaults to now)
 * @returns Lead time in hours
 */
export function computeLeadTimeHours(targetDate: string, now?: Date): number {
  const current = now ?? new Date();

  // Target date at noon local time (rough approximation)
  // The high usually occurs in the afternoon, low in early morning
  const target = new Date(targetDate + "T18:00:00Z"); // ~1PM ET

  const diffMs = target.getTime() - current.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.max(0, diffHours);
}
