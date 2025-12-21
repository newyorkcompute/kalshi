#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  getKalshiConfig,
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

const SERVER_NAME = "kalshi-mcp";
const SERVER_VERSION = "0.2.0";

async function main() {
  // Initialize Kalshi SDK
  const config = getKalshiConfig();
  const marketApi = createMarketApi(config);
  const portfolioApi = createPortfolioApi(config);
  const ordersApi = createOrdersApi(config);
  const eventsApi = createEventsApi(config);

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
  registerCreateOrder(server, ordersApi);
  registerCancelOrder(server, ordersApi);

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
