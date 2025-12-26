#!/usr/bin/env node
/**
 * Kalshi TUI - Terminal Trading Dashboard
 * Built with Ink for buttery-smooth rendering
 * 
 * Built by New York Compute
 */

import { render } from 'ink';
import { App } from './App.js';

// Handle --help and --version flags
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Kalshi TUI - Terminal Trading Dashboard

  Usage:
    kalshi-tui [options]

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

// Check if stdin supports raw mode (required for keyboard input)
const isRawModeSupported = process.stdin.isTTY;

if (!isRawModeSupported) {
  console.error(`
  Error: Kalshi TUI requires an interactive terminal.

  This usually happens when running through a task runner or piped input.
  
  Try running directly:
    node dist/cli.js
  
  Or:
    npx @newyorkcompute/kalshi-tui
`);
  process.exit(1);
}

// Render the app
render(<App />);

