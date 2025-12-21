#!/usr/bin/env node
/**
 * CLI entry point for running the Kalshi MCP server via npx/command line
 *
 * This allows users to run: npx @newyorkcompute/kalshi-mcp
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createServer, { SERVER_NAME, SERVER_VERSION } from "./index.js";

async function main() {
  // Create server (will use environment variables for config)
  const server = createServer();

  // Start server with stdio transport
  const transport = new StdioServerTransport();

  // The server returned is the raw Server, need to connect transport
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

