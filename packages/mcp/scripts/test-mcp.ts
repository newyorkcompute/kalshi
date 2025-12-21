#!/usr/bin/env npx tsx
/**
 * Test script to verify MCP server works
 * Run with: npx tsx scripts/test-mcp.ts
 */

import { spawn } from "child_process";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local from repo root
config({ path: resolve(__dirname, "../../../.env.local") });

// JSON-RPC message ID counter
let messageId = 1;

function createMessage(method: string, params?: object) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: messageId++,
    method,
    params,
  });
}

async function main() {
  console.log("🚀 Starting MCP server...\n");

  const serverPath = resolve(__dirname, "../dist/index.js");

  const server = spawn("node", [serverPath], {
    env: {
      ...process.env,
      KALSHI_API_KEY: process.env.KALSHI_API_KEY,
      KALSHI_PRIVATE_KEY: process.env.KALSHI_PRIVATE_KEY,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Collect stderr for server logs
  server.stderr?.on("data", (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  // Set up readline for stdout
  const rl = readline.createInterface({
    input: server.stdout!,
    crlfDelay: Infinity,
  });

  const responses: string[] = [];

  rl.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      responses.push(line);
      console.log("📥 Response:", JSON.stringify(response, null, 2), "\n");
    } catch {
      console.log("[stdout]", line);
    }
  });

  // Helper to send and wait
  const send = (msg: string) => {
    console.log("📤 Sending:", msg.slice(0, 100) + (msg.length > 100 ? "..." : ""));
    server.stdin?.write(msg + "\n");
  };

  // Give server time to start
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Initialize
  console.log("\n─── Step 1: Initialize ───");
  send(
    createMessage("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    })
  );
  await new Promise((r) => setTimeout(r, 500));

  // 2. Send initialized notification
  send(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
  await new Promise((r) => setTimeout(r, 500));

  // 3. List tools
  console.log("\n─── Step 2: List Tools ───");
  send(createMessage("tools/list", {}));
  await new Promise((r) => setTimeout(r, 500));

  // 4. Call get_markets tool
  console.log("\n─── Step 3: Call get_markets (limit: 3) ───");
  send(
    createMessage("tools/call", {
      name: "get_markets",
      arguments: { limit: 3 },
    })
  );
  await new Promise((r) => setTimeout(r, 3000));

  // Clean up
  console.log("\n✅ Test complete! Shutting down server...");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

