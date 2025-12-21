#!/usr/bin/env npx tsx
/**
 * Test script to verify Kalshi API connection
 * Run with: npx tsx scripts/test-connection.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Configuration, MarketApi } from "kalshi-typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local from repo root
config({ path: resolve(__dirname, "../../../.env.local") });

async function main() {
  console.log("🔑 Checking environment variables...");

  const apiKey = process.env.KALSHI_API_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;

  if (!apiKey) {
    console.error("❌ KALSHI_API_KEY not found in .env.local");
    process.exit(1);
  }
  console.log(`  ✓ KALSHI_API_KEY: ${apiKey.slice(0, 8)}...`);

  if (!privateKey) {
    console.error("❌ KALSHI_PRIVATE_KEY not found in .env.local");
    process.exit(1);
  }
  console.log(`  ✓ KALSHI_PRIVATE_KEY: ${privateKey.slice(0, 30)}...`);

  console.log("\n🌐 Connecting to Kalshi API...");

  const sdkConfig = new Configuration({
    apiKey,
    privateKeyPem: privateKey,
    basePath: "https://api.elections.kalshi.com/trade-api/v2",
  });

  const marketApi = new MarketApi(sdkConfig);

  try {
    console.log("\n📊 Fetching markets (limit: 5)...\n");
    const response = await marketApi.getMarkets(5);

    const markets = response.data.markets || [];

    if (markets.length === 0) {
      console.log("No markets found (this might be okay)");
    } else {
      console.log("Markets found:");
      console.log("─".repeat(60));
      for (const market of markets) {
        console.log(`  ${market.ticker}`);
        console.log(`    Title: ${market.title}`);
        console.log(`    Status: ${market.status}`);
        console.log(
          `    Yes: ${market.yes_bid}¢ bid / ${market.yes_ask}¢ ask`
        );
        console.log(`    Volume 24h: ${market.volume_24h}`);
        console.log("");
      }
    }

    console.log("✅ Connection successful! API is working.\n");
  } catch (error) {
    console.error("❌ API request failed:");
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if ("response" in error) {
        const axiosError = error as any;
        console.error(`  Status: ${axiosError.response?.status}`);
        console.error(`  Data: ${JSON.stringify(axiosError.response?.data)}`);
      }
    }
    process.exit(1);
  }
}

main();

