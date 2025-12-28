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
 */

import { Bot } from "./daemon/bot.js";
import { loadConfig, getConfigTemplate } from "./config.js";
import { startControlPlane } from "./api/server.js";

async function main(): Promise<void> {
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

main().catch((error) => {
  console.error("[Main] Unhandled error:", error);
  process.exit(1);
});

