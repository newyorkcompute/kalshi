/**
 * Temperature Probability Model
 *
 * Models the uncertainty in NWS temperature forecasts using a Gaussian distribution.
 *
 * Key insight: NWS forecasts have well-studied error distributions.
 * The actual temperature is approximately:
 *
 *   actual_temp ~ Normal(forecast, sigma)
 *
 * where sigma depends on the forecast lead time (how far ahead the forecast is).
 *
 * Sigma values are based on published NWS forecast verification studies:
 * - RMSE for 1-day high temp forecasts: ~2-3°F
 * - RMSE for 2-day: ~3-4°F
 * - RMSE for 3-day: ~4-6°F
 *
 * These values are CALIBRATABLE — log predictions vs outcomes and adjust.
 *
 * @see https://www.weather.gov/media/mdl/MOS_Performance.pdf
 */

// ─── Sigma Table ────────────────────────────────────────────────────────────

/**
 * Default forecast error standard deviation (°F) indexed by lead time.
 * These are conservative starting values based on NWS verification data.
 *
 * For high temperatures:
 * - Same-day forecasts are very accurate (sigma 1.5-2°F)
 * - Next-day forecasts are good (sigma 2.5°F)
 * - 2-3 day forecasts have more uncertainty (sigma 3.5-5°F)
 *
 * Low temperature forecasts are slightly less accurate (add ~0.5°F).
 */
export interface SigmaConfig {
  /** Sigma for 0-6 hour lead time */
  hours0to6: number;
  /** Sigma for 6-12 hour lead time */
  hours6to12: number;
  /** Sigma for 12-24 hour lead time */
  hours12to24: number;
  /** Sigma for 24-48 hour lead time */
  hours24to48: number;
  /** Sigma for 48-72 hour lead time */
  hours48to72: number;
  /** Sigma for 72+ hour lead time */
  hours72plus: number;
}

export const DEFAULT_HIGH_SIGMA: SigmaConfig = {
  hours0to6: 1.5,
  hours6to12: 2.0,
  hours12to24: 2.5,
  hours24to48: 3.5,
  hours48to72: 5.0,
  hours72plus: 6.5,
};

export const DEFAULT_LOW_SIGMA: SigmaConfig = {
  hours0to6: 2.0,
  hours6to12: 2.5,
  hours12to24: 3.0,
  hours24to48: 4.0,
  hours48to72: 5.5,
  hours72plus: 7.0,
};

/**
 * Get the appropriate sigma for a given lead time.
 */
export function getSigma(leadTimeHours: number, config: SigmaConfig): number {
  if (leadTimeHours <= 6) return config.hours0to6;
  if (leadTimeHours <= 12) return config.hours6to12;
  if (leadTimeHours <= 24) return config.hours12to24;
  if (leadTimeHours <= 48) return config.hours24to48;
  if (leadTimeHours <= 72) return config.hours48to72;
  return config.hours72plus;
}

// ─── Gaussian CDF ───────────────────────────────────────────────────────────

/**
 * Standard normal CDF: Phi(x) = P(Z <= x) where Z ~ N(0,1).
 *
 * Uses the Abramowitz and Stegun approximation for erfc (formula 7.1.26),
 * then converts to CDF via: Phi(x) = 1 - 0.5 * erfc(x / sqrt(2)).
 * Accurate to ~1.5e-7.
 */
export function standardNormalCDF(x: number): number {
  // Handle extreme values
  if (x < -8) return 0;
  if (x > 8) return 1;

  // Phi(x) = 0.5 * erfc(-x / sqrt(2))
  // For the approximation, we compute erfc for positive argument,
  // then use symmetry.

  // Constants for Abramowitz & Stegun erfc approximation (7.1.26)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // erfc(z) for z >= 0:
  // erfc(z) ≈ (a1*t + a2*t^2 + a3*t^3 + a4*t^4 + a5*t^5) * exp(-z^2)
  // where t = 1/(1 + p*z)
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const erfcZ = (a1 * t + a2 * t * t + a3 * t * t * t +
    a4 * t * t * t * t + a5 * t * t * t * t * t) * Math.exp(-z * z);

  // Phi(x) = 1 - 0.5 * erfc(x / sqrt(2))
  // For x >= 0: erfc(x/sqrt(2)) = erfcZ
  // For x < 0:  erfc(x/sqrt(2)) = 2 - erfcZ (by symmetry of erfc)
  if (x >= 0) {
    return 1.0 - 0.5 * erfcZ;
  } else {
    return 0.5 * erfcZ;
  }
}

// ─── Probability Calculations ───────────────────────────────────────────────

/**
 * P(temp > strike) given a forecast and sigma.
 *
 * This is used for "above" markets (e.g., "Will high > 85°F?")
 */
export function probAbove(forecast: number, strike: number, sigma: number): number {
  if (sigma <= 0) {
    // Degenerate case: no uncertainty
    return forecast > strike ? 1.0 : 0.0;
  }
  const z = (strike - forecast) / sigma;
  return 1.0 - standardNormalCDF(z);
}

/**
 * P(temp < strike) given a forecast and sigma.
 *
 * This is used for "below" markets (e.g., "Will high < 72°F?")
 */
export function probBelow(forecast: number, strike: number, sigma: number): number {
  if (sigma <= 0) {
    return forecast < strike ? 1.0 : 0.0;
  }
  const z = (strike - forecast) / sigma;
  return standardNormalCDF(z);
}

/**
 * P(rangeLow <= temp <= rangeHigh) given a forecast and sigma.
 *
 * This is used for "range" markets (e.g., "Will high be 82-83°F?")
 */
export function probInRange(
  forecast: number,
  rangeLow: number,
  rangeHigh: number,
  sigma: number,
): number {
  if (sigma <= 0) {
    return forecast >= rangeLow && forecast <= rangeHigh ? 1.0 : 0.0;
  }
  const zLow = (rangeLow - forecast) / sigma;
  const zHigh = (rangeHigh - forecast) / sigma;
  return standardNormalCDF(zHigh) - standardNormalCDF(zLow);
}

/**
 * Convert a probability (0-1) to a fair price in cents (1-99).
 */
export function probToCents(probability: number): number {
  const cents = Math.round(probability * 100);
  return Math.max(1, Math.min(99, cents));
}
