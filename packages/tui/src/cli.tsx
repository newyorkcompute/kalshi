#!/usr/bin/env node
/**
 * Kalshi TUI - Terminal Trading Dashboard
 *
 * A beautiful terminal interface for Kalshi prediction markets.
 * Built by New York Compute.
 */

import React from "react";
import { render } from "ink";
import { App } from "./App.js";

// Handle --help and --version flags
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  Kalshi TUI - Terminal Trading Dashboard

  Usage:
    kalshi-tui [options]

  Options:
    --help, -h       Show this help message
    --version, -v    Show version number
    --about          Show about information

  Environment Variables:
    KALSHI_API_KEY       Your Kalshi API key ID (required)
    KALSHI_PRIVATE_KEY   RSA private key in PEM format (required)
    KALSHI_BASE_PATH     API base URL (optional, defaults to production)

  Examples:
    $ kalshi-tui
    $ KALSHI_API_KEY=xxx KALSHI_PRIVATE_KEY="..." kalshi-tui

  Built by New York Compute
  https://newyorkcompute.xyz
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log("0.1.0");
  process.exit(0);
}

if (args.includes("--about")) {
  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │   ▓ KALSHI TUI                                          │
  │   NEW YORK COMPUTE                                       │
  │                                                          │
  │   Free. Open source. Beautiful.                          │
  │                                                          │
  │   A terminal so polished that the screenshot alone       │
  │   is the pitch. No AI. No gimmicks. Pure craft.          │
  │                                                          │
  │   Version: 0.1.0                                         │
  │   License: MIT                                           │
  │                                                          │
  │   GitHub:  github.com/newyorkcompute/kalshi              │
  │   Website: newyorkcompute.xyz                            │
  │                                                          │
  │   Want this for equities? Request early access:          │
  │   → newyorkcompute.xyz                                   │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
`);
  process.exit(0);
}

// Render the app
render(<App />);

