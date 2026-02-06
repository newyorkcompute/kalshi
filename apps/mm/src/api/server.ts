/**
 * Control Plane API
 *
 * Optional HTTP API for monitoring and controlling the bot.
 * Includes scanner endpoints for dynamic market management.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { Bot } from "../daemon/bot.js";

/**
 * Create the Hono control plane app
 */
export function createControlPlane(bot: Bot) {
  const app = new Hono();

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Metrics (for monitoring)
  app.get("/metrics", (c) => {
    return c.json(bot.getMetrics());
  });

  // Full state (positions, orders, PnL)
  app.get("/state", (c) => {
    return c.json(bot.getState());
  });

  // Pause quoting
  app.post("/pause", (c) => {
    bot.pause();
    return c.json({ paused: true });
  });

  // Resume quoting
  app.post("/resume", (c) => {
    bot.resume();
    return c.json({ paused: false });
  });

  // Flatten (cancel all orders)
  app.post("/flatten", async (c) => {
    await bot.flatten();
    return c.json({ flattened: true });
  });

  // ─── Scanner & Market Management ────────────────────────────────────

  // Trigger a scan and return results
  app.post("/scan", async (c) => {
    const scanner = bot.getScanner();
    if (!scanner) {
      return c.json({ error: "Scanner not enabled. Set scanner.enabled: true in config." }, 400);
    }

    try {
      const result = await scanner.scan();
      return c.json({
        totalScanned: result.totalScanned,
        selected: result.markets.length,
        rejected: result.rejected,
        durationMs: result.durationMs,
        markets: result.markets.map((m) => ({
          ticker: m.ticker,
          title: m.title,
          category: m.category,
          spread: m.spread,
          totalDepth: m.totalDepth,
          volume24h: m.volume24h,
          isLongshot: m.isLongshot,
          compositeScore: m.compositeScore,
        })),
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get last scan result (cached)
  app.get("/scan", (c) => {
    const result = bot.getLastScanResult();
    if (!result) {
      return c.json({ error: "No scan results yet. POST /scan to trigger a scan." }, 404);
    }

    return c.json({
      totalScanned: result.totalScanned,
      selected: result.markets.length,
      rejected: result.rejected,
      durationMs: result.durationMs,
      timestamp: result.timestamp.toISOString(),
      markets: result.markets.map((m) => ({
        ticker: m.ticker,
        title: m.title,
        category: m.category,
        spread: m.spread,
        totalDepth: m.totalDepth,
        volume24h: m.volume24h,
        isLongshot: m.isLongshot,
        compositeScore: m.compositeScore,
      })),
    });
  });

  // List active markets with per-market P&L
  app.get("/markets", (c) => {
    const activeMarkets = bot.getActiveMarkets();
    const marketPnL = bot.getMarketPnL();

    const markets = activeMarkets.map((ticker) => {
      const pnl = marketPnL.get(ticker);
      return {
        ticker,
        realized: pnl?.realized ?? 0,
        fills: pnl?.fills ?? 0,
        addedAt: pnl?.addedAt ? new Date(pnl.addedAt).toISOString() : null,
      };
    });

    return c.json({
      count: markets.length,
      markets,
    });
  });

  // Add a market manually
  app.post("/markets/:ticker", async (c) => {
    const ticker = c.req.param("ticker");
    if (!ticker) {
      return c.json({ error: "Ticker is required" }, 400);
    }

    await bot.addMarket(ticker);
    return c.json({ added: ticker, totalMarkets: bot.getActiveMarkets().length });
  });

  // Remove a market manually
  app.delete("/markets/:ticker", async (c) => {
    const ticker = c.req.param("ticker");
    if (!ticker) {
      return c.json({ error: "Ticker is required" }, 400);
    }

    await bot.removeMarket(ticker);
    return c.json({ removed: ticker, totalMarkets: bot.getActiveMarkets().length });
  });

  return app;
}

/**
 * Start the control plane server
 */
export function startControlPlane(bot: Bot, port: number): void {
  const app = createControlPlane(bot);

  console.log(`[API] Control plane starting on http://localhost:${port}`);
  console.log("[API] Endpoints:");
  console.log("  GET  /health           - Liveness check");
  console.log("  GET  /metrics          - Monitoring metrics");
  console.log("  GET  /state            - Full bot state");
  console.log("  POST /pause            - Pause quoting");
  console.log("  POST /resume           - Resume quoting");
  console.log("  POST /flatten          - Cancel all orders");
  console.log("  GET  /scan             - Last scan results");
  console.log("  POST /scan             - Trigger new scan");
  console.log("  GET  /markets          - Active markets + P&L");
  console.log("  POST /markets/:ticker  - Add market");
  console.log("  DELETE /markets/:ticker - Remove market");

  serve({
    fetch: app.fetch,
    port,
  });
}

