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
  "media": { weight: 0.95, expectedGapPP: 7.28, label: "Media" },
  "entertainment": { weight: 0.85, expectedGapPP: 4.79, label: "Entertainment" },
  "culture": { weight: 0.85, expectedGapPP: 4.79, label: "Culture" },
  "awards": { weight: 0.85, expectedGapPP: 4.79, label: "Awards" },

  // Tier 2: Good maker edge (emotional + some volume)
  "crypto": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "bitcoin": { weight: 0.70, expectedGapPP: 2.69, label: "Crypto" },
  "weather": { weight: 0.65, expectedGapPP: 2.57, label: "Weather" },
  "climate": { weight: 0.65, expectedGapPP: 2.57, label: "Climate" },

  // Tier 3: Moderate maker edge (high volume, moderate inefficiency)
  "sports": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nfl": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nba": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "mlb": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "nhl": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "soccer": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "mma": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },
  "tennis": { weight: 0.55, expectedGapPP: 2.23, label: "Sports" },

  // Tier 4: Low maker edge (partially informed participants)
  "politics": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "elections": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },
  "congress": { weight: 0.35, expectedGapPP: 1.02, label: "Politics" },

  // Tier 5: Near-efficient (quantitative participants, avoid)
  "finance": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "economics": { weight: 0.05, expectedGapPP: 0.17, label: "Economics" },
  "fed": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "interest-rate": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "gdp": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "cpi": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "jobs": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
  "unemployment": { weight: 0.05, expectedGapPP: 0.17, label: "Finance" },
};

/** Default profile for categories we don't recognize */
const DEFAULT_PROFILE: CategoryProfile = {
  weight: 0.40,
  expectedGapPP: 1.5,
  label: "Unknown",
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

  // Direct category match
  if (lowerCat && CATEGORY_PROFILES[lowerCat]) {
    return CATEGORY_PROFILES[lowerCat];
  }

  // Substring match on category (only if category is non-empty)
  if (lowerCat) {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (lowerCat.includes(key) || key.includes(lowerCat)) {
        return profile;
      }
    }
  }

  // Ticker-based heuristics (Kalshi tickers often encode category)
  if (lowerTicker) {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (lowerTicker.includes(key)) {
        return profile;
      }
    }
  }

  // Title-based heuristics
  if (lowerTitle) {
    for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
      if (lowerTitle.includes(key)) {
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
  "fed",
  "interest-rate",
  "gdp",
  "cpi",
  "jobs",
  "unemployment",
]);

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
  const financePatterns = ["kxfed", "kxcpi", "kxgdp", "kxjobs", "kxrate", "kxsp500", "kxsnp"];
  return financePatterns.some(p => lowerTicker.includes(p));
}
