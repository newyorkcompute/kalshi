#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getKalshiConfig, createMarketApi } from "./config.js";
import { registerGetMarkets } from "./tools/get-markets.js";
import { registerGetMarket } from "./tools/get-market.js";
import { registerGetOrderbook } from "./tools/get-orderbook.js";

const SERVER_NAME = "kalshi-mcp";
const SERVER_VERSION = "0.1.0";

async function main() {
  // Initialize Kalshi SDK
  const config = getKalshiConfig();
  const marketApi = createMarketApi(config);

  // Create MCP server
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register tools
  registerGetMarkets(server, marketApi);
  registerGetMarket(server, marketApi);
  registerGetOrderbook(server, marketApi);

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

