/**
 * Performance analysis CLI for market-maker fill logs and Kalshi settlements.
 *
 * Run from apps/mm (matches bot log directory resolution):
 *   npm run analyze
 *   npm run analyze -- --logs ./logs --since 2025-01-01 --json
 *
 * Or directly:
 *   npx tsx scripts/analyze-performance.ts [--logs <dir>] [--since <date>] [--json]
 */

import {
  DEFAULT_LOGS_DIR,
  buildPerformanceReport,
  formatReportTables,
  loadFillsFromDir,
  normalizeSettlement,
} from "../src/analysis/performance.js";
import {
  createPortfolioApi,
  DEFAULT_BASE_PATH,
  type KalshiConfig,
} from "@newyorkcompute/kalshi-core";

interface CliOptions {
  logsDir: string;
  json: boolean;
  since?: Date;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    logsDir: DEFAULT_LOGS_DIR,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--logs") {
      const value = argv[++i];
      if (!value) throw new Error("--logs requires a directory path");
      options.logsDir = value;
    } else if (arg === "--since") {
      const value = argv[++i];
      if (!value) throw new Error("--since requires an ISO date");
      const since = new Date(value);
      if (Number.isNaN(since.getTime())) {
        throw new Error(`Invalid --since date: ${value}`);
      }
      options.since = since;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: analyze-performance [options]

Options:
  --logs <dir>     Directory with fills-*.jsonl logs (default: ./logs)
  --since <date>   Only include fills/settlements on or after this date
  --json           Output report as JSON
  -h, --help       Show this help
`);
}

function tryGetKalshiConfig(): KalshiConfig | null {
  const apiKey = process.env.KALSHI_API_KEY;
  let privateKey = process.env.KALSHI_PRIVATE_KEY;
  if (!apiKey || !privateKey) return null;

  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return {
    apiKey,
    privateKey,
    basePath: process.env.KALSHI_BASE_PATH || DEFAULT_BASE_PATH,
  };
}

async function fetchSettlements(
  config: KalshiConfig,
  since?: Date,
): Promise<ReturnType<typeof normalizeSettlement>[]> {
  const api = createPortfolioApi(config);
  const settlements: NonNullable<ReturnType<typeof normalizeSettlement>>[] = [];
  let cursor: string | undefined;
  const minTs = since ? Math.floor(since.getTime() / 1000) : undefined;

  do {
    const response = await api.getSettlements(
      200,
      cursor,
      undefined,
      undefined,
      minTs,
    );
    const batch = response.data?.settlements ?? [];
    for (const raw of batch) {
      const normalized = normalizeSettlement(raw);
      if (normalized) settlements.push(normalized);
    }
    cursor = response.data?.cursor || undefined;
  } while (cursor);

  return settlements;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const warnings: string[] = [];

  const { fills, filesRead } = loadFillsFromDir(options.logsDir, options.since);
  if (filesRead === 0) {
    warnings.push(`No fills-*.jsonl files found in ${options.logsDir}`);
  }

  let settlements: NonNullable<ReturnType<typeof normalizeSettlement>>[] = [];
  const kalshiConfig = tryGetKalshiConfig();
  if (!kalshiConfig) {
    warnings.push(
      "KALSHI_API_KEY / KALSHI_PRIVATE_KEY not set — running fills-only analysis",
    );
  } else {
    try {
      settlements = await fetchSettlements(kalshiConfig, options.since);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to load settlements from Kalshi API: ${message}`);
    }
  }

  const report = buildPerformanceReport(fills, settlements, warnings);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReportTables(report));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
