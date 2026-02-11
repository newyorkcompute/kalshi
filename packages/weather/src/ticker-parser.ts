/**
 * Weather Ticker Parser
 *
 * Parses Kalshi weather tickers into structured data.
 *
 * Ticker formats observed:
 * - KXHIGHAUS-26FEB12-T85     → Austin high, Feb 12 2026, >85°F
 * - KXHIGHAUS-26FEB12-T78     → Austin high, Feb 12 2026, <78°F (when strike_type="less")
 * - KXHIGHAUS-26FEB12-B82.5   → Austin high, Feb 12 2026, 82-83°F (range bucket)
 * - KXHIGHNY-26FEB11-T43      → NYC high, Feb 11 2026, >43°F
 * - KXLOWTCHI-26FEB11-B23.5   → Chicago low, Feb 11 2026, 23-24°F (range bucket)
 * - KXHIGHTLV-26FEB11-T64     → Las Vegas high, Feb 11 2026, >64°F
 *
 * Structure: KX{HIGH|LOWT}{CITY_CODE}-{YY}{MON}{DD}-{T|B}{STRIKE}
 *
 * Note: The "T" prefix in KXHIGHT* is part of "HIGH" + "T" for the city code,
 * while "T" in the strike portion means threshold. Context disambiguates.
 */

import type { ParsedTicker, StrikeDirection, TempType } from "./types.js";
import { lookupCity } from "./cities.js";

/** Month abbreviation to number */
const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04",
  MAY: "05", JUN: "06", JUL: "07", AUG: "08",
  SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/**
 * Parse a Kalshi weather ticker into structured data.
 *
 * @param ticker - Full Kalshi ticker (e.g., "KXHIGHAUS-26FEB12-T85")
 * @param strikeType - Optional strike type from market data ("greater", "less", "between").
 *                     If not provided, inferred from the strike prefix.
 * @returns Parsed ticker or null if not a weather ticker
 */
export function parseWeatherTicker(
  ticker: string,
  strikeType?: string,
): ParsedTicker | null {
  // Must start with KX
  if (!ticker.startsWith("KX")) return null;

  // Split into parts: KX{TYPE}{CITY}-{DATE}-{STRIKE}
  const parts = ticker.split("-");
  if (parts.length !== 3) return null;

  const [prefix, dateStr, strikeStr] = parts;
  if (!prefix || !dateStr || !strikeStr) return null;

  // ─── Parse prefix: KX{HIGH|LOWT}{CITY} ───
  const { tempType, cityCode } = parsePrefixPart(prefix);
  if (!tempType || !cityCode) return null;

  // Verify city exists in our database
  const city = lookupCity(cityCode);
  if (!city) return null;

  // ─── Parse date: {YY}{MON}{DD} → YYYY-MM-DD ───
  const date = parseDatePart(dateStr);
  if (!date) return null;

  // ─── Parse strike: {T|B}{NUMBER} ───
  const strikeData = parseStrikePart(strikeStr, strikeType);
  if (!strikeData) return null;

  return {
    ticker,
    tempType,
    cityCode: city.kalshiCode, // Use canonical code
    date,
    strike: strikeData.strike,
    direction: strikeData.direction,
    rangeLow: strikeData.rangeLow,
    rangeHigh: strikeData.rangeHigh,
  };
}

/**
 * Check if a ticker is a weather ticker (without full parsing).
 */
export function isWeatherTicker(ticker: string): boolean {
  return (
    ticker.startsWith("KXHIGH") ||
    ticker.startsWith("KXLOWT")
  );
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function parsePrefixPart(prefix: string): { tempType: TempType | null; cityCode: string | null } {
  let tempType: TempType | null = null;
  let cityCode: string | null = null;

  if (prefix.startsWith("KXHIGH")) {
    tempType = "high";
    cityCode = prefix.slice(6); // After "KXHIGH"
  } else if (prefix.startsWith("KXLOWT")) {
    tempType = "low";
    cityCode = prefix.slice(6); // After "KXLOWT"
  }

  if (!cityCode || cityCode.length === 0) {
    return { tempType: null, cityCode: null };
  }

  return { tempType, cityCode };
}

function parseDatePart(dateStr: string): string | null {
  // Format: YYmmmDD (e.g., "26FEB12")
  // YY = 2 digits, mmm = 3-letter month, DD = 2 digits
  const match = dateStr.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;

  const [, yy, mon, dd] = match;
  if (!yy || !mon || !dd) return null;

  const mm = MONTH_MAP[mon];
  if (!mm) return null;

  // Assume 20xx century
  return `20${yy}-${mm}-${dd}`;
}

function parseStrikePart(
  strikeStr: string,
  strikeType?: string,
): {
  strike: number;
  direction: StrikeDirection;
  rangeLow?: number;
  rangeHigh?: number;
} | null {
  if (strikeStr.length < 2) return null;

  const prefix = strikeStr[0];
  const valueStr = strikeStr.slice(1);
  const value = parseFloat(valueStr);

  if (isNaN(value)) return null;

  if (prefix === "T") {
    // "T" = threshold. Could be "above" or "below" depending on strikeType.
    // Default: if strikeType is "less", it's "below"; otherwise "above"
    const direction: StrikeDirection =
      strikeType === "less" ? "below" : "above";
    return { strike: value, direction };
  }

  if (prefix === "B") {
    // "B" = bucket/range. The value is the midpoint of a 2-degree bucket.
    // E.g., B82.5 → 82-83°F, B23.5 → 23-24°F
    const rangeLow = Math.floor(value);
    const rangeHigh = Math.ceil(value);
    return {
      strike: value,
      direction: "range",
      rangeLow,
      rangeHigh,
    };
  }

  return null;
}
