/**
 * Scanner Module
 */

export {
  MarketScanner,
  formatScanResults,
  DEFAULT_SCANNER_CONFIG,
  type ScannerConfig,
  type ScoredMarket,
  type ScanResult,
} from "./market-scanner.js";

export {
  getCategoryProfile,
  getCategoryWeight,
  shouldAvoidCategory,
  AVOID_CATEGORIES,
  type CategoryProfile,
} from "./category-weights.js";
