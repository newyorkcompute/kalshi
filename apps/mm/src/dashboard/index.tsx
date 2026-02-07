#!/usr/bin/env node
/**
 * MM Dashboard - Terminal UI for monitoring the market maker bot.
 *
 * Usage:
 *   npx tsx src/dashboard/index.tsx
 *   npx tsx src/dashboard/index.tsx --port 3001
 *   npm run dashboard
 */

import React from "react";
import { render } from "ink";
import { Dashboard } from "./Dashboard.js";

// Parse --port flag
const portArg = process.argv.find((a) => a.startsWith("--port"));
const portIdx = process.argv.indexOf("--port");
const port =
  portArg && portArg.includes("=")
    ? parseInt(portArg.split("=")[1], 10)
    : portIdx >= 0 && process.argv[portIdx + 1]
      ? parseInt(process.argv[portIdx + 1], 10)
      : 3001;

console.clear();
render(<Dashboard port={port} />);
