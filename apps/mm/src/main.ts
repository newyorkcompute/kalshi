#!/usr/bin/env node
/**
 * Market Maker Daemon
 *
 * Entry point for the market maker bot.
 *
 * Usage:
 *   npm run dev                    # Development mode with hot reload
 *   npm start                      # Production mode
 *   MM_CONFIG=path/to/config.yaml npm start
 *   npm start -- --scan            # One-shot market scan (no trading)
 *   npm start -- --scan --deep     # Deep scan with orderbook depth
 *   npm start -- --init            # Generate config template
 *   npm run dashboard              # Launch terminal dashboard (monitors running bot)
 *   npm start -- --dashboard       # Same as above
 */

import { Bot } from "./daemon/bot.js";
import { loadConfig, getConfigTemplate, getKalshiCredentials, getBasePath } from "./config.js";
import { startControlPlane } from "./api/server.js";
import { MarketScanner, formatScanResults, type ScannerConfig } from "./scanner/index.js";
import { createMarketApi } from "@newyorkcompute/kalshi-core";

function patchConsoleTimestamps(): void {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  const ts = (): string => {
    const d = new Date();
    return `[${d.toLocaleTimeString("en-US", { hour12: false })}]`;
  };

  console.log = (...args: unknown[]) => origLog(ts(), ...args);
  console.warn = (...args: unknown[]) => origWarn(ts(), ...args);
  console.error = (...args: unknown[]) => origError(ts(), ...args);
}

async function main(): Promise<void> {
  patchConsoleTimestamps();

  console.log("╔═══════════════════════════════════════╗");
  console.log("║     Kalshi Market Maker Daemon        ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log();

  // Check for --init flag
  if (process.argv.includes("--init")) {
    console.log("Creating config.yaml template...\n");
    console.log(getConfigTemplate());
    console.log("\nCopy the above to config.yaml and customize.");
    process.exit(0);
  }

  // Check for --dashboard flag (launch TUI monitor)
  if (process.argv.includes("--dashboard")) {
    const { render } = await import("ink");
    const React = await import("react");
    const { Dashboard } = await import("./dashboard/Dashboard.js");
    const portArg = process.argv.find((a) => a.startsWith("--port"));
    const portIdx = process.argv.indexOf("--port");
    const port =
      portArg && portArg.includes("=")
        ? parseInt(portArg.split("=")[1], 10)
        : portIdx >= 0 && process.argv[portIdx + 1]
          ? parseInt(process.argv[portIdx + 1], 10)
          : 3001;
    console.clear();
    render(React.createElement(Dashboard, { port }));
    return;
  }

  // Check for --scan flag (one-shot market scan, no trading)
  if (process.argv.includes("--scan")) {
    await runScanOnly();
    process.exit(0);
  }

  // Load configuration
  let config;
  try {
    config = loadConfig();
    console.log("[Config] Loaded successfully");
  } catch (error) {
    console.error("[Config] Error:", (error as Error).message);
    console.log("\nRun with --init to generate a config template.");
    process.exit(1);
  }

  // Create bot
  const bot = new Bot(config);

  // Start optional control plane
  if (config.api.enabled) {
    startControlPlane(bot, config.api.port);
  }

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.log(`\n[Main] Received ${signal}, shutting down...`);
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start the bot
  try {
    await bot.start();
  } catch (error) {
    console.error("[Main] Bot failed:", error);
    process.exit(1);
  }
}

/**
 * One-shot market scan mode.
 * Scans the market, prints results, and exits. No trading.
 */
async function runScanOnly(): Promise<void> {
  const isDeep = process.argv.includes("--deep");

  console.log(`[Scan] Running ${isDeep ? "DEEP" : "fast"} market scan...\n`);

  // Load config for scanner settings (if available)
  let scannerConfig: Partial<ScannerConfig> = {};
  try {
    const config = loadConfig();
    scannerConfig = config.scanner as Partial<ScannerConfig>;
  } catch {
    console.log("[Scan] No config.yaml found, using defaults\n");
  }

  // Create API client
  const credentials = getKalshiCredentials();
  let demo = true;
  try {
    const config = loadConfig();
    demo = config.kalshi.demo;
  } catch {
    // Default to demo
  }

  const marketApi = createMarketApi({
    apiKey: credentials.apiKey,
    privateKey: credentials.privateKey,
    basePath: getBasePath(demo),
  });

  const scanner = new MarketScanner(marketApi, scannerConfig);

  try {
    const result = isDeep ? await scanner.deepScan() : await scanner.scan();
    console.log(formatScanResults(result));

    // Print tickers for easy copy-paste into config
    console.log("\n  Market tickers (for config.yaml):");
    console.log("  markets:");
    for (const m of result.markets.slice(0, 30)) {
      console.log(`    - ${m.ticker}  # ${m.title.slice(0, 50)} [${m.category}]`);
    }
    console.log();
  } catch (error) {
    console.error("[Scan] Failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Main] Unhandled error:", error);
  process.exit(1);
});

