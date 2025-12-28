/**
 * Configuration Loader
 *
 * Loads and validates configuration from YAML file and environment variables.
 */

import { readFileSync, existsSync } from "fs";
import { z } from "zod";
import yaml from "js-yaml";
import {
  DEFAULT_BASE_PATH,
  DEMO_BASE_PATH,
  DEFAULT_RISK_LIMITS,
} from "@newyorkcompute/kalshi-core";

// Schema definitions
const ApiConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().min(1).max(65535).default(3001),
});

const KalshiConfigSchema = z.object({
  demo: z.boolean().default(true), // Default to demo for safety!
});

const SymmetricStrategySchema = z.object({
  spreadCents: z.number().min(1).max(50).default(4),
  sizePerSide: z.number().min(1).max(100).default(10),
});

const AdaptiveStrategySchema = z.object({
  edgeCents: z.number().min(0).max(10).default(1),
  minSpreadCents: z.number().min(1).max(20).default(2),
  sizePerSide: z.number().min(1).max(100).default(5),
  maxMarketSpread: z.number().min(5).max(50).default(20),
  skewFactor: z.number().min(0).max(5).default(0.5),
  maxInventorySkew: z.number().min(1).max(100).default(30),
  // Phase 2: Elite MM options
  useMicroprice: z.boolean().default(true),
  multiLevel: z.boolean().default(false),
  adverseSelectionMultiplier: z.number().min(1).max(10).default(2.0),
  // Phase 3: Dynamic Skew + Imbalance Awareness
  dynamicSkew: z.boolean().default(true),
  imbalanceSkewMultiplier: z.number().min(0).max(5).default(1.5),
  extremeImbalanceThreshold: z.number().min(0.1).max(1).default(0.6),
  reduceRiskySideOnImbalance: z.boolean().default(true),
  imbalanceSizeReduction: z.number().min(0.1).max(1).default(0.5),
  // Time-decay near expiry
  expiryWidenStartSec: z.number().min(60).max(86400).default(3600),
  expiryStopQuoteSec: z.number().min(0).max(3600).default(300),
  expirySpreadMultiplier: z.number().min(1).max(5).default(1.5),
});

const AvellanedaStrategySchema = z.object({
  gamma: z.number().min(0.01).max(10).default(0.1),
  k: z.number().min(0.1).max(10).default(1.5),
  sigma: z.number().min(0.01).max(1).default(0.15),
  T: z.number().min(60).max(86400).default(3600),  // Time horizon in seconds
  maxPosition: z.number().min(1).max(1000).default(100),
  sizePerSide: z.number().min(1).max(100).default(5),
  minSpread: z.number().min(1).max(20).default(2),
  maxSpread: z.number().min(5).max(50).default(20),
  useMarketExpiry: z.boolean().default(true),
});

const StrategyConfigSchema = z.object({
  name: z.enum(["symmetric", "adaptive", "avellaneda"]).default("symmetric"),
  symmetric: SymmetricStrategySchema.default({}),
  adaptive: AdaptiveStrategySchema.default({}),
  avellaneda: AvellanedaStrategySchema.default({}),
});

const RiskConfigSchema = z.object({
  maxPositionPerMarket: z
    .number()
    .min(1)
    .default(DEFAULT_RISK_LIMITS.maxPositionPerMarket),
  maxTotalExposure: z
    .number()
    .min(1)
    .default(DEFAULT_RISK_LIMITS.maxTotalExposure),
  maxDailyLoss: z.number().min(1).default(DEFAULT_RISK_LIMITS.maxDailyLoss),
  maxOrderSize: z.number().min(1).default(DEFAULT_RISK_LIMITS.maxOrderSize),
  minSpread: z.number().min(1).default(DEFAULT_RISK_LIMITS.minSpread),
});

const DaemonConfigSchema = z.object({
  staleOrderMs: z.number().min(1000).default(30000),
  reconnectDelayMs: z.number().min(100).default(5000),
});

const ConfigSchema = z.object({
  api: ApiConfigSchema.default({}),
  kalshi: KalshiConfigSchema.default({}),
  strategy: StrategyConfigSchema.default({}),
  markets: z.array(z.string()).min(1),
  risk: RiskConfigSchema.default({}),
  daemon: DaemonConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;
export type RiskConfig = z.infer<typeof RiskConfigSchema>;

/**
 * Load configuration from YAML file
 */
export function loadConfig(configPath?: string): Config {
  const path = configPath || process.env.MM_CONFIG || "config.yaml";

  if (!existsSync(path)) {
    throw new Error(
      `Config file not found: ${path}\n` +
        "Create a config.yaml or set MM_CONFIG environment variable."
    );
  }

  const fileContent = readFileSync(path, "utf-8");
  const rawConfig = yaml.load(fileContent);

  // Validate with Zod
  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Get Kalshi API credentials from environment
 */
export function getKalshiCredentials(): {
  apiKey: string;
  privateKey: string;
} {
  const apiKey = process.env.KALSHI_API_KEY;
  let privateKey = process.env.KALSHI_PRIVATE_KEY;

  if (!apiKey) {
    throw new Error("KALSHI_API_KEY environment variable is required");
  }

  if (!privateKey) {
    throw new Error("KALSHI_PRIVATE_KEY environment variable is required");
  }

  // Handle escaped newlines from .env files
  // e.g., "-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----"
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return { apiKey, privateKey };
}

/**
 * Get the API base path based on demo mode
 */
export function getBasePath(demo: boolean): string {
  return demo ? DEMO_BASE_PATH : DEFAULT_BASE_PATH;
}

/**
 * Create a default config file template
 */
export function getConfigTemplate(): string {
  return `# Market Maker Daemon Configuration
# Copy this file to config.yaml and customize

# Optional HTTP control plane
api:
  enabled: true
  port: 3001

# Kalshi settings
kalshi:
  demo: true  # IMPORTANT: Start with demo mode!

# Strategy selection
strategy:
  name: symmetric  # or 'avellaneda'
  
  symmetric:
    spreadCents: 4        # Total spread (2¢ bid, 2¢ ask)
    sizePerSide: 10       # Contracts per side
    
  avellaneda:
    gamma: 0.1            # Risk aversion (higher = wider spreads)
    k: 1.5                # Order arrival rate
    sigma: 0.15           # Volatility estimate
    maxPosition: 100      # Max inventory per side

# Markets to quote (at least one required)
markets:
  - KXBTC-25JAN03-B60K  # Example: BTC above 60k by Jan 3

# Risk limits
risk:
  maxPositionPerMarket: 100   # Max contracts per market
  maxTotalExposure: 500       # Max total contracts
  maxDailyLoss: 5000          # Max loss in cents ($50)
  maxOrderSize: 25            # Max contracts per order
  minSpread: 2                # Min spread in cents

# Daemon settings
daemon:
  staleOrderMs: 30000         # Cancel orders older than 30s
  reconnectDelayMs: 5000      # WebSocket reconnect delay
`;
}

