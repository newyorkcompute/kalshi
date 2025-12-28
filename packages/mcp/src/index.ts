/**
 * Kalshi MCP Server
 *
 * MCP server for interacting with Kalshi prediction markets via AI assistants.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  createMarketApi,
  createPortfolioApi,
  createOrdersApi,
  createEventsApi,
} from "./config.js";

// Market tools
import { registerGetMarkets } from "./tools/get-markets.js";
import { registerGetMarket } from "./tools/get-market.js";
import { registerGetOrderbook } from "./tools/get-orderbook.js";
import { registerGetTrades } from "./tools/get-trades.js";

// Event tools
import { registerGetEvents } from "./tools/get-events.js";
import { registerGetEvent } from "./tools/get-event.js";

// Portfolio tools
import { registerGetBalance } from "./tools/get-balance.js";
import { registerGetPositions } from "./tools/get-positions.js";

// Order tools
import { registerGetOrders } from "./tools/get-orders.js";
import { registerCreateOrder } from "./tools/create-order.js";
import { registerCancelOrder } from "./tools/cancel-order.js";
import { registerBatchCancelOrders } from "./tools/batch-cancel-orders.js";

// Fill and settlement tools
import { registerGetFills } from "./tools/get-fills.js";
import { registerGetSettlements } from "./tools/get-settlements.js";

export const SERVER_NAME = "kalshi-mcp";
export const SERVER_VERSION = "0.3.0";

/**
 * Configuration schema for Kalshi API authentication
 */
export const configSchema = z.object({
  KALSHI_API_KEY: z.string().describe("Your Kalshi API key ID"),
  KALSHI_PRIVATE_KEY: z
    .string()
    .describe("RSA private key in PEM format for API authentication"),
});

export type Config = z.infer<typeof configSchema>;

interface CreateServerOptions {
  config?: Config;
}

/**
 * Creates and configures the Kalshi MCP server
 *
 * @param options - Server options including config object or environment variables
 * @returns Configured MCP server instance
 */
export default function createServer(options: CreateServerOptions = {}) {
  // Get config from options or fall back to environment variables
  const apiKey = options.config?.KALSHI_API_KEY || process.env.KALSHI_API_KEY;
  const privateKey =
    options.config?.KALSHI_PRIVATE_KEY || process.env.KALSHI_PRIVATE_KEY;

  if (!apiKey || !privateKey) {
    throw new Error(
      "Missing Kalshi credentials. Provide KALSHI_API_KEY and KALSHI_PRIVATE_KEY via config or environment variables."
    );
  }

  // Create Kalshi SDK configuration
  const basePath =
    process.env.KALSHI_BASE_PATH ||
    "https://api.elections.kalshi.com/trade-api/v2";

  const kalshiConfig = {
    apiKey,
    privateKey: privateKey,
    basePath,
  };

  // Initialize API clients
  const marketApi = createMarketApi(kalshiConfig);
  const portfolioApi = createPortfolioApi(kalshiConfig);
  const ordersApi = createOrdersApi(kalshiConfig);
  const eventsApi = createEventsApi(kalshiConfig);

  // Create MCP server
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register market tools
  registerGetMarkets(server, marketApi);
  registerGetMarket(server, marketApi);
  registerGetOrderbook(server, marketApi);
  registerGetTrades(server, marketApi);

  // Register event tools
  registerGetEvents(server, eventsApi);
  registerGetEvent(server, eventsApi);

  // Register portfolio tools
  registerGetBalance(server, portfolioApi);
  registerGetPositions(server, portfolioApi);

  // Register order tools
  registerGetOrders(server, ordersApi);
  registerCreateOrder(server, ordersApi, marketApi, portfolioApi);
  registerCancelOrder(server, ordersApi);
  registerBatchCancelOrders(server, ordersApi);

  // Register fill and settlement tools
  registerGetFills(server, portfolioApi);
  registerGetSettlements(server, portfolioApi);

  // Return the underlying server instance
  return server.server;
}
