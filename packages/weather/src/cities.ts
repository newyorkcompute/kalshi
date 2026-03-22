/**
 * City Configuration
 *
 * Maps Kalshi weather ticker codes to city metadata including
 * NWS station IDs and coordinates for API lookups.
 *
 * Kalshi settles weather markets using the NWS Climatological Report (Daily)
 * for the corresponding station. The station IDs here match those reports.
 *
 * @see https://help.kalshi.com/markets/popular-markets/weather-markets
 * @see https://wethr.net/edu/city-resources
 */

import type { CityConfig } from "./types.js";

/**
 * All Kalshi weather cities.
 *
 * Key = Kalshi ticker code (the part after "KXHIGH" or "KXLOWT").
 * Coordinates are for the NWS weather station used in settlement.
 */
export const CITIES: Record<string, CityConfig> = {
  // ─── A ────────────────────────────────────────────────────────
  ATL: {
    kalshiCode: "ATL",
    name: "Atlanta",
    nwsStation: "KATL",
    lat: 33.6407,
    lon: -84.4277,
  },
  AUS: {
    kalshiCode: "AUS",
    name: "Austin",
    nwsStation: "KAUS",
    lat: 30.1945,
    lon: -97.6699,
  },

  // ─── B ────────────────────────────────────────────────────────
  BOS: {
    kalshiCode: "BOS",
    name: "Boston",
    nwsStation: "KBOS",
    lat: 42.3656,
    lon: -71.0096,
  },

  // ─── C ────────────────────────────────────────────────────────
  CLT: {
    kalshiCode: "CLT",
    name: "Charlotte",
    nwsStation: "KCLT",
    lat: 35.2144,
    lon: -80.9473,
  },
  CHI: {
    kalshiCode: "CHI",
    name: "Chicago",
    nwsStation: "KORD",
    lat: 41.9742,
    lon: -87.9073,
  },

  // ─── D ────────────────────────────────────────────────────────
  DFW: {
    kalshiCode: "DFW",
    name: "Dallas",
    nwsStation: "KDFW",
    lat: 32.8998,
    lon: -97.0403,
  },
  DEN: {
    kalshiCode: "DEN",
    name: "Denver",
    nwsStation: "KDEN",
    lat: 39.8561,
    lon: -104.6737,
  },
  DTW: {
    kalshiCode: "DTW",
    name: "Detroit",
    nwsStation: "KDTW",
    lat: 42.2124,
    lon: -83.3534,
  },

  // ─── H ────────────────────────────────────────────────────────
  HOU: {
    kalshiCode: "HOU",
    name: "Houston",
    nwsStation: "KHOU",
    lat: 29.6454,
    lon: -95.2789,
  },

  // ─── J ────────────────────────────────────────────────────────
  JAX: {
    kalshiCode: "JAX",
    name: "Jacksonville",
    nwsStation: "KJAX",
    lat: 30.4941,
    lon: -81.6879,
  },

  // ─── L ────────────────────────────────────────────────────────
  LV: {
    kalshiCode: "LV",
    name: "Las Vegas",
    nwsStation: "KLAS",
    lat: 36.0840,
    lon: -115.1537,
  },
  LAX: {
    kalshiCode: "LAX",
    name: "Los Angeles",
    nwsStation: "KLAX",
    lat: 33.9416,
    lon: -118.4085,
  },

  // ─── M ────────────────────────────────────────────────────────
  MIA: {
    kalshiCode: "MIA",
    name: "Miami",
    nwsStation: "KMIA",
    lat: 25.7959,
    lon: -80.2870,
  },
  MSP: {
    kalshiCode: "MSP",
    name: "Minneapolis",
    nwsStation: "KMSP",
    lat: 44.8820,
    lon: -93.2218,
  },

  // ─── N ────────────────────────────────────────────────────────
  BNA: {
    kalshiCode: "BNA",
    name: "Nashville",
    nwsStation: "KBNA",
    lat: 36.1245,
    lon: -86.6782,
  },
  MSY: {
    kalshiCode: "MSY",
    name: "New Orleans",
    nwsStation: "KMSY",
    lat: 29.9934,
    lon: -90.2580,
  },
  NY: {
    kalshiCode: "NY",
    name: "New York City",
    nwsStation: "KNYC",
    lat: 40.7789,
    lon: -73.9692,
  },

  // ─── O ────────────────────────────────────────────────────────
  OKC: {
    kalshiCode: "OKC",
    name: "Oklahoma City",
    nwsStation: "KOKC",
    lat: 35.3931,
    lon: -97.6007,
  },

  // ─── P ────────────────────────────────────────────────────────
  PHIL: {
    kalshiCode: "PHIL",
    name: "Philadelphia",
    nwsStation: "KPHL",
    lat: 39.8721,
    lon: -75.2411,
  },
  PHX: {
    kalshiCode: "PHX",
    name: "Phoenix",
    nwsStation: "KPHX",
    lat: 33.4373,
    lon: -112.0078,
  },

  // ─── S ────────────────────────────────────────────────────────
  SAT: {
    kalshiCode: "SAT",
    name: "San Antonio",
    nwsStation: "KSAT",
    lat: 29.5337,
    lon: -98.4698,
  },
  SFO: {
    kalshiCode: "SFO",
    name: "San Francisco",
    nwsStation: "KSFO",
    lat: 37.6213,
    lon: -122.3790,
  },
  SEA: {
    kalshiCode: "SEA",
    name: "Seattle",
    nwsStation: "KSEA",
    lat: 47.4502,
    lon: -122.3088,
  },

  // ─── T ────────────────────────────────────────────────────────
  TPA: {
    kalshiCode: "TPA",
    name: "Tampa",
    nwsStation: "KTPA",
    lat: 27.9756,
    lon: -82.5333,
  },

  // ─── W ────────────────────────────────────────────────────────
  DCA: {
    kalshiCode: "DCA",
    name: "Washington DC",
    nwsStation: "KDCA",
    lat: 38.8512,
    lon: -77.0402,
  },
};

/**
 * Alternative ticker code mappings.
 * Some Kalshi tickers use slightly different city codes.
 * Maps alternative code → canonical code in CITIES.
 */
export const CITY_ALIASES: Record<string, string> = {
  // Kalshi uses "T" prefix for some cities in KXHIGHT* tickers
  TATL: "ATL",
  TAUS: "AUS",
  TBOS: "BOS",
  TCLT: "CLT",
  TCHI: "CHI",
  TDFW: "DFW",
  TDEN: "DEN",
  TDTW: "DTW",
  THOU: "HOU",
  TJAX: "JAX",
  TLV: "LV",
  TLAX: "LAX",
  TMIA: "MIA",
  TMSP: "MSP",
  TBNA: "BNA",
  TMSY: "MSY",
  TNY: "NY",
  TOKC: "OKC",
  TPHIL: "PHIL",
  TPHX: "PHX",
  TSAT: "SAT",
  TSFO: "SFO",
  TSEA: "SEA",
  TTPA: "TPA",
  TDCA: "DCA",
};

/**
 * Look up a city by its Kalshi ticker code.
 * Handles both canonical codes and aliases.
 */
export function lookupCity(code: string): CityConfig | null {
  const upper = code.toUpperCase();

  // Direct match
  if (CITIES[upper]) {
    return CITIES[upper];
  }

  // Alias match
  const canonical = CITY_ALIASES[upper];
  if (canonical && CITIES[canonical]) {
    return CITIES[canonical];
  }

  return null;
}

/**
 * Get all supported city codes.
 */
export function getAllCityCodes(): string[] {
  return Object.keys(CITIES);
}
