#!/usr/bin/env node
/**
 * Kalshi TUI - Vanilla Terminal Dashboard
 * No React, no Ink - just pure terminal control
 * 
 * Built by New York Compute
 */

import { startApp } from './app.js';

// Handle --help
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Kalshi TUI - Terminal Trading Dashboard (Vanilla)

  Usage:
    kalshi-tui-vanilla [options]

  Options:
    --help, -h       Show this help message
    --version, -v    Show version number

  Environment Variables:
    KALSHI_API_KEY       Your Kalshi API key ID (required)
    KALSHI_PRIVATE_KEY   RSA private key in PEM format (required)

  Controls:
    ↑/↓      Navigate markets
    q        Quit

  Built by New York Compute
  https://newyorkcompute.xyz
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('0.1.0');
  process.exit(0);
}

// Start the app
startApp().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

