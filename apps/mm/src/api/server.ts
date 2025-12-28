/**
 * Control Plane API
 *
 * Optional HTTP API for monitoring and controlling the bot.
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

  return app;
}

/**
 * Start the control plane server
 */
export function startControlPlane(bot: Bot, port: number): void {
  const app = createControlPlane(bot);

  console.log(`[API] Control plane starting on http://localhost:${port}`);
  console.log("[API] Endpoints:");
  console.log("  GET  /health   - Liveness check");
  console.log("  GET  /metrics  - Monitoring metrics");
  console.log("  GET  /state    - Full bot state");
  console.log("  POST /pause    - Pause quoting");
  console.log("  POST /resume   - Resume quoting");
  console.log("  POST /flatten  - Cancel all orders");

  serve({
    fetch: app.fetch,
    port,
  });
}

