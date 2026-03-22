#!/usr/bin/env npx tsx
/**
 * Model vs Market Comparison
 *
 * Computes fair values for real Kalshi weather markets and compares
 * to live market prices to identify edge opportunities.
 *
 * Usage:
 *   npx tsx src/compare-markets.ts
 */

import { NWSClient } from "./nws-client.js";
import { CITIES } from "./cities.js";
import { parseWeatherTicker } from "./ticker-parser.js";
import { computeFairValue, computeLeadTimeHours } from "./fair-value.js";
import { probAbove, probBelow, probInRange, getSigma, DEFAULT_HIGH_SIGMA, DEFAULT_LOW_SIGMA, type SigmaConfig } from "./probability-model.js";

// Hard-coded from live Kalshi data (fetched moments ago)
interface LiveMarket {
  ticker: string;
  title: string;
  yesBid: number;
  yesAsk: number;
  strikeType?: string; // "greater", "less", or "between"
}

const LIVE_DATA: { city: string; date: string; forecast: { highF: number; lowF: number }; markets: LiveMarket[] }[] = [
  {
    city: "AUS",
    date: "2026-02-12",
    forecast: { highF: 80, lowF: 59 },
    markets: [
      { ticker: "KXHIGHAUS-26FEB12-T85", title: ">85°", yesBid: 4, yesAsk: 6 },
      { ticker: "KXHIGHAUS-26FEB12-T78", title: "<78°", yesBid: 10, yesAsk: 11, strikeType: "less" },
      { ticker: "KXHIGHAUS-26FEB12-B84.5", title: "84-85°", yesBid: 0, yesAsk: 0 },
      { ticker: "KXHIGHAUS-26FEB12-B82.5", title: "82-83°", yesBid: 22, yesAsk: 23 },
      { ticker: "KXHIGHAUS-26FEB12-B80.5", title: "80-81°", yesBid: 26, yesAsk: 62 },
      { ticker: "KXHIGHAUS-26FEB12-B78.5", title: "78-79°", yesBid: 24, yesAsk: 25 },
    ],
  },
  {
    city: "CHI",
    date: "2026-02-12",
    forecast: { highF: 41, lowF: 29 },
    markets: [
      { ticker: "KXHIGHCHI-26FEB12-T45", title: ">45°", yesBid: 3, yesAsk: 4 },
      { ticker: "KXHIGHCHI-26FEB12-T38", title: "<38°", yesBid: 11, yesAsk: 12, strikeType: "less" },
      { ticker: "KXHIGHCHI-26FEB12-B44.5", title: "44-45°", yesBid: 0, yesAsk: 0 },
      { ticker: "KXHIGHCHI-26FEB12-B42.5", title: "42-43°", yesBid: 16, yesAsk: 25 },
      { ticker: "KXHIGHCHI-26FEB12-B40.5", title: "40-41°", yesBid: 35, yesAsk: 36 },
      { ticker: "KXHIGHCHI-26FEB12-B38.5", title: "38-39°", yesBid: 28, yesAsk: 29 },
    ],
  },
  {
    city: "NY",
    date: "2026-02-12",
    forecast: { highF: 36, lowF: 22 },
    markets: [
      { ticker: "KXHIGHNY-26FEB12-T39", title: ">39°", yesBid: 0, yesAsk: 0 },
      { ticker: "KXHIGHNY-26FEB12-T32", title: "<32°", yesBid: 4, yesAsk: 7, strikeType: "less" },
      { ticker: "KXHIGHNY-26FEB12-B38.5", title: "38-39°", yesBid: 18, yesAsk: 25 },
      { ticker: "KXHIGHNY-26FEB12-B36.5", title: "36-37°", yesBid: 42, yesAsk: 50 },
      { ticker: "KXHIGHNY-26FEB12-B34.5", title: "34-35°", yesBid: 30, yesAsk: 37 },
      { ticker: "KXHIGHNY-26FEB12-B32.5", title: "32-33°", yesBid: 2, yesAsk: 11 },
    ],
  },
];

function main() {
  console.log("🌡️  MODEL vs MARKET — Live Kalshi Weather Contracts");
  console.log("═".repeat(80));
  console.log();

  // Calibrated sigma based on market-implied values
  const CALIBRATED_HIGH_SIGMA: SigmaConfig = {
    hours0to6: 1.0,
    hours6to12: 1.2,
    hours12to24: 1.5,
    hours24to48: 2.0,
    hours48to72: 3.0,
    hours72plus: 4.5,
  };

  const allEdges: { ticker: string; city: string; title: string; marketMid: number; modelCents: number; edge: number; action: string }[] = [];

  for (const event of LIVE_DATA) {
    const forecast = { date: event.date, highF: event.forecast.highF, lowF: event.forecast.lowF, fetchedAt: new Date() };
    const leadTime = computeLeadTimeHours(event.date);
    const sigma = getSigma(leadTime, CALIBRATED_HIGH_SIGMA);
    const cityName = CITIES[event.city]?.name ?? event.city;

    console.log(`📊 ${cityName} — ${event.date} (Forecast: ${event.forecast.highF}°F high, σ=${sigma}°F, lead=${leadTime.toFixed(0)}h)`);
    console.log(`${"─".repeat(80)}`);
    console.log(`  ${"Ticker".padEnd(30)} ${"Title".padEnd(8)} ${"Market".padEnd(8)} ${"Model".padEnd(8)} ${"Edge".padEnd(8)} Action`);
    console.log(`  ${"─".repeat(74)}`);

    for (const mkt of event.markets) {
      if (mkt.yesBid <= 0 && mkt.yesAsk <= 0) continue; // Skip dead markets

      const parsed = parseWeatherTicker(mkt.ticker, mkt.strikeType);
      if (!parsed) continue;

      const fv = computeFairValue(parsed, forecast, leadTime, { highSigma: CALIBRATED_HIGH_SIGMA });
      const marketMid = (mkt.yesBid + mkt.yesAsk) / 2;
      const edge = marketMid - fv.fairPriceCents;
      const absEdge = Math.abs(edge);
      const action = absEdge >= 3 ? (edge > 0 ? "SELL ✋" : "BUY  🟢") : "skip";

      const edgeStr = edge > 0 ? `+${edge.toFixed(1)}¢` : `${edge.toFixed(1)}¢`;
      const marker = absEdge >= 3 ? " ⬅" : "";

      console.log(
        `  ${mkt.ticker.padEnd(30)} ${mkt.title.padEnd(8)} ` +
        `${marketMid.toFixed(0).padStart(3)}¢     ` +
        `${fv.fairPriceCents.toString().padStart(3)}¢     ` +
        `${edgeStr.padStart(6)}  ${action}${marker}`
      );

      if (absEdge >= 3) {
        allEdges.push({
          ticker: mkt.ticker,
          city: cityName,
          title: mkt.title,
          marketMid,
          modelCents: fv.fairPriceCents,
          edge,
          action: edge > 0 ? "SELL" : "BUY",
        });
      }
    }
    console.log();
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("═".repeat(80));
  console.log(`\n🎯 EDGE OPPORTUNITIES (|edge| >= 3¢):\n`);

  if (allEdges.length === 0) {
    console.log("  None found — market is well-priced relative to our model.");
  } else {
    allEdges.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));
    for (const e of allEdges) {
      const dir = e.edge > 0 ? "overpriced" : "underpriced";
      console.log(
        `  ${e.action} ${e.ticker} — market ${e.marketMid.toFixed(0)}¢ vs model ${e.modelCents}¢ ` +
        `(${dir} by ${Math.abs(e.edge).toFixed(1)}¢)`
      );
    }
  }

  console.log();
  console.log("⚠️  NOTE: Our initial sigma (3.5°F at 26h) may be too wide.");
  console.log("   Markets imply tighter uncertainty — sigma calibration needed.");
  console.log("   The bot will still only trade when edge is clear, so this is safe.\n");
}

main();
