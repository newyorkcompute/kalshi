/**
 * Category Weights
 *
 * Research-backed profitability weights per Kalshi market category.
 *
 * Based on Becker (2025) "The Microstructure of Wealth Transfer in Prediction Markets":
 *   - Maker-taker gap by category (percentage points):
 *     World Events: 7.32pp, Media: 7.28pp, Entertainment: 4.79pp,
 *     Crypto: 2.69pp, Weather: 2.57pp, Sports: 2.23pp,
 *     Politics: 1.02pp, Finance: 0.17pp
 *
 * Higher weight = more profitable for makers (larger optimism tax).
 * Lower weight = more efficient market (harder to profit).
 *
 * @see https://www.jbecker.dev/research/prediction-market-microstructure
 */

export interface CategoryProfile {
  /** Profitability weight 0-1 (1 = highest maker edge) */
  weight: number;
  /** Expected maker-taker gap in percentage points */
  expectedGapPP: number;
  /** Human-readable label */
  label: string;
}

/**
 * Map of Kalshi category keywords to profitability profiles.
 *
 * Category matching is case-insensitive and uses substring matching,
 * so "nfl" matches "Sports", "bitcoin" matches "Crypto", etc.
 */
const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  // Tier 1: Highest maker edge (emotional, low-information markets)
  "world-events": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "world_events": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "warming": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "colonize": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "mars": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "millennium": { weight: 1.0, expectedGapPP: 7.32, label: "World Events" },
  "media": { weight: 0.95, expectedGapPP: 7.28, label: "Media" },
  "entertainment": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "culture": { weight: 0.85, expectedGapPP: 4.79, label: "Culture" },
  "awards": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "oscar": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "grammy": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "emmy": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "actor": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "movie": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "bond": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "perform": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "halftime": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "superbowl": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "super bowl": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },

  // Tier 2: Good maker edge (emotional + some volume)
  "crypto": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "bitcoin": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "btc": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "eth": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "solana": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "sol": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "doge": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "weather": { weight: 0.65, expectedGapPP: 2.57, label: "Weather" },
  "climate": { weight: 0.65, expectedGapPP: 2.57, label: "Weather" },
  "temperature": { weight: 0.65, expectedGapPP: 2.57, label: "Weather" },
  "hurricane": { weight: 0.65, expectedGapPP: 2.57, label: "Weather" },

  // Tier 3: Moderate maker edge (high volume, moderate inefficiency)
  "sports": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nfl": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nba": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "mlb": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nhl": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "soccer": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "epl": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "premier league": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "champions league": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "laliga": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "bundesliga": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "mma": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "ufc": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "tennis": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "pga": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "golf": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "lpga": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "dpworld": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "livtour": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "f1": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nascar": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "wnba": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "ncaa": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "touchdown": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "total points": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "spread": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "winner": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },

  // Tier 4: Low maker edge (partially informed participants)
  "politics": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "elections": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "congress": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "senate": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "president": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "impeach": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "governor": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "scotus": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "supreme court": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "tariff": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "democrat": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "republican": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "drun": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },

  // Tier 5: Near-efficient (quantitative participants, avoid)
  "finance": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "economics": { weight: 0.05, expectedGapPP: 0.17, label: "Economics" },
  "interest-rate": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "gdp": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "cpi": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "unemployment": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
};

/** Default profile for categories we don't recognize */
const DEFAULT_PROFILE: CategoryProfile = {
  weight: 0.40,
  expectedGapPP: 1.5,
  label: "Unknown",
};

/**
 * Kalshi ticker prefix → category mapping.
 * Kalshi tickers look like "KXPGA-...", "KXNFL-...", etc.
 * We strip "KX" and match the prefix.
 */
const TICKER_PREFIX_MAP: Record<string, CategoryProfile> = {
  // Sports
  "nfl": CATEGORY_PROFILES["nfl"],
  "nba": CATEGORY_PROFILES["nba"],
  "mlb": CATEGORY_PROFILES["mlb"],
  "nhl": CATEGORY_PROFILES["nhl"],
  "pga": CATEGORY_PROFILES["pga"],
  "lpga": CATEGORY_PROFILES["lpga"],
  "dpworld": CATEGORY_PROFILES["dpworld"],
  "livtour": CATEGORY_PROFILES["livtour"],
  "epl": CATEGORY_PROFILES["epl"],
  "ufc": CATEGORY_PROFILES["ufc"],
  "mma": CATEGORY_PROFILES["mma"],
  "f1": CATEGORY_PROFILES["f1"],
  "nascar": CATEGORY_PROFILES["nascar"],
  "ncaa": CATEGORY_PROFILES["ncaa"],
  "wnba": CATEGORY_PROFILES["wnba"],
  "tennis": CATEGORY_PROFILES["tennis"],

  // Crypto
  "btc": CATEGORY_PROFILES["btc"],
  "eth": CATEGORY_PROFILES["eth"],
  "sol": CATEGORY_PROFILES["sol"],
  "doge": CATEGORY_PROFILES["doge"],
  "crypto": CATEGORY_PROFILES["crypto"],
  "bitcoin": CATEGORY_PROFILES["bitcoin"],

  // Entertainment
  "perform": CATEGORY_PROFILES["perform"],
  "actor": CATEGORY_PROFILES["actor"],
  "oscar": CATEGORY_PROFILES["oscar"],
  "grammy": CATEGORY_PROFILES["grammy"],
  "emmy": CATEGORY_PROFILES["emmy"],
  "halftime": CATEGORY_PROFILES["halftime"],
  "bond": CATEGORY_PROFILES["bond"],
  "movie": CATEGORY_PROFILES["movie"],
  "sbsetlists": CATEGORY_PROFILES["entertainment"],  // SB halftime setlist
  "sb": CATEGORY_PROFILES["entertainment"],            // Super Bowl props

  // Sports - NFL props (Super Bowl specific)
  "nflfirsttd": CATEGORY_PROFILES["nfl"],   // First touchdown scorer
  "nflatd": CATEGORY_PROFILES["nfl"],        // Anytime touchdown
  "nfl2dtd": CATEGORY_PROFILES["nfl"],       // 2+ touchdowns
  "nflspread": CATEGORY_PROFILES["nfl"],     // Point spreads
  "nfltotal": CATEGORY_PROFILES["nfl"],      // Over/under totals
  "nflmvp": CATEGORY_PROFILES["nfl"],        // MVP

  // Weather
  "hurricane": CATEGORY_PROFILES["hurricane"],
  "temp": CATEGORY_PROFILES["temperature"],

  // Politics
  "senate": CATEGORY_PROFILES["senate"],
  "impeach": CATEGORY_PROFILES["impeach"],
  "scotus": CATEGORY_PROFILES["scotus"],
  "tariff": CATEGORY_PROFILES["tariff"],
  "drun": CATEGORY_PROFILES["drun"],
  "gov": CATEGORY_PROFILES["governor"],

  // Finance (avoid)
  "fed": CATEGORY_PROFILES["finance"],
  "cpi": CATEGORY_PROFILES["cpi"],
  "gdpnow": CATEGORY_PROFILES["gdp"],
  "gdp": CATEGORY_PROFILES["gdp"],
  "rate": CATEGORY_PROFILES["interest-rate"],
  "sp500": CATEGORY_PROFILES["finance"],
  "snp": CATEGORY_PROFILES["finance"],
  "jobs": CATEGORY_PROFILES["finance"],

  // World Events
  "warming": CATEGORY_PROFILES["warming"],
  "colonize": CATEGORY_PROFILES["colonize"],
};

/**
 * Get the profitability profile for a market based on its category or ticker.
 *
 * Tries to match the category string first, then falls back to ticker-based
 * heuristics (e.g., "KXNFL..." → sports).
 */
export function getCategoryProfile(
  category: string,
  ticker?: string,
  title?: string,
): CategoryProfile {
  const lowerCat = category.toLowerCase().trim();
  const lowerTicker = (ticker ?? "").toLowerCase();
  const lowerTitle = (title ?? "").toLowerCase();

  // 1. Direct category match
  if (lowerCat && CATEGORY_PROFILES[lowerCat]) {
    return CATEGORY_PROFILES[lowerCat];
  }

  // 2. Substring match on category (only if category is non-empty)
  if (lowerCat) {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (lowerCat.includes(key) || key.includes(lowerCat)) {
        return profile;
      }
    }
  }

  // 3. Ticker prefix matching (most Kalshi tickers are KX<PREFIX>-<DETAILS>)
  if (lowerTicker) {
    // Strip common "kx" prefix
    const stripped = lowerTicker.startsWith("kx") ? lowerTicker.slice(2) : lowerTicker;

    // Try longest prefix match first (e.g., "dpworld" before "dp")
    const prefixKeys = Object.keys(TICKER_PREFIX_MAP).sort((a, b) => b.length - a.length);
    for (const prefix of prefixKeys) {
      if (stripped.startsWith(prefix)) {
        return TICKER_PREFIX_MAP[prefix];
      }
    }

    // Also try substring match on the full ticker for broader patterns
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (key.length >= 3 && lowerTicker.includes(key)) {
        return profile;
      }
    }
  }

  // 4. Title-based keyword matching (match whole words or significant substrings)
  if (lowerTitle) {
    // Try keywords that are at least 3 chars long to avoid false positives
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (key.length >= 3 && lowerTitle.includes(key)) {
        return profile;
      }
    }
  }

  return DEFAULT_PROFILE;
}

/**
 * Get the category weight (0-1) for scoring.
 * Shorthand for getCategoryProfile().weight
 */
export function getCategoryWeight(
  category: string,
  ticker?: string,
  title?: string,
): number {
  return getCategoryProfile(category, ticker, title).weight;
}

/**
 * Categories to completely avoid (near-efficient markets).
 * These have maker-taker gaps under 0.5pp.
 */
export const AVOID_CATEGORIES = new Set([
  "finance",
  "economics",
  "interest-rate",
  "unemployment",
]);

/**
 * Ticker prefixes that identify finance markets (to avoid).
 */
const FINANCE_TICKER_PREFIXES = [
  "kxfed", "kxcpi", "kxgdp", "kxgdpnow", "kxjobs",
  "kxrate", "kxsp500", "kxsnp", "kxinfl",
];

/**
 * Check if a category should be avoided entirely.
 */
export function shouldAvoidCategory(
  category: string,
  ticker?: string,
): boolean {
  const lower = category.toLowerCase().trim();
  if (AVOID_CATEGORIES.has(lower)) return true;

  // Check ticker for finance-related patterns
  const lowerTicker = (ticker ?? "").toLowerCase();
  return FINANCE_TICKER_PREFIXES.some(p => lowerTicker.startsWith(p));
}
