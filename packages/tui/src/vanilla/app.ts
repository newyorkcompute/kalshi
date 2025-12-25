/**
 * Vanilla TUI Application
 * No React, no Ink - just direct terminal control
 */

import readline from 'readline';
import {
  cursor,
  screen,
  color,
  getTerminalSize,
  writeAt,
  drawBox,
  truncate,
  padRight,
  formatCurrency,
  formatPrice,
} from './terminal.js';
import { 
  createMarketApi, 
  createPortfolioApi, 
  getKalshiConfig,
  type MarketDisplay, 
  type OrderbookDisplay 
} from '@newyorkcompute/kalshi-core';
import type { MarketApi, PortfolioApi, Market, MarketPosition } from 'kalshi-typescript';

// App state
interface AppState {
  markets: MarketDisplay[];
  orderbook: OrderbookDisplay | null;
  balance: number | null;
  positions: Array<{ ticker: string; position: number; market_exposure: number }>;
  selectedMarketIndex: number;
  isConnected: boolean;
  error: string | null;
}

const state: AppState = {
  markets: [],
  orderbook: null,
  balance: null,
  positions: [],
  selectedMarketIndex: 0,
  isConnected: false,
  error: null,
};

// API clients
let marketApi: MarketApi | null = null;
let portfolioApi: PortfolioApi | null = null;

// Polling intervals
let marketsInterval: NodeJS.Timeout | null = null;
let orderbookInterval: NodeJS.Timeout | null = null;
let portfolioInterval: NodeJS.Timeout | null = null;

// Render lock to prevent concurrent renders
let isRendering = false;

/**
 * Safe render - prevents concurrent renders
 */
function safeRender() {
  if (isRendering) return;
  isRendering = true;
  try {
    render();
  } finally {
    isRendering = false;
  }
}

/**
 * Initialize the API client
 */
function initClient() {
  try {
    const config = getKalshiConfig();
    marketApi = createMarketApi(config);
    portfolioApi = createPortfolioApi(config);
    return true;
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to create client';
    return false;
  }
}

/**
 * Fetch markets
 */
async function fetchMarkets() {
  if (!marketApi) return;
  
  try {
    const response = await marketApi.getMarkets(100, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'open');
    state.markets = (response.data.markets || []).map((m: Market) => ({
      ticker: m.ticker || '',
      title: m.title || '',
      status: (m.status || 'open') as MarketDisplay['status'],
      yes_bid: m.yes_bid,
      yes_ask: m.yes_ask,
      no_bid: m.no_bid,
      no_ask: m.no_ask,
      volume: m.volume,
      open_interest: m.open_interest,
      close_time: m.close_time,
    }));
    state.isConnected = true;
  } catch (err) {
    // Silently fail, will retry
  }
}

/**
 * Fetch orderbook for selected market
 */
async function fetchOrderbook() {
  if (!marketApi || state.markets.length === 0) return;
  
  const ticker = state.markets[state.selectedMarketIndex]?.ticker;
  if (!ticker) return;
  
  try {
    const response = await marketApi.getMarketOrderbook(ticker, 10);
    const ob = response.data.orderbook;
    if (ob) {
      const parseLevel = (entry: string[]): [number, number] => [
        parseFloat(entry[0] || '0'),
        parseInt(entry[1] || '0', 10),
      ];
      state.orderbook = {
        yes: (ob.yes_dollars || []).map(parseLevel),
        no: (ob.no_dollars || []).map(parseLevel),
      };
    }
  } catch (err) {
    // Silently fail
  }
}

/**
 * Fetch portfolio (balance + positions)
 */
async function fetchPortfolio() {
  if (!portfolioApi) return;
  
  try {
    const [balanceRes, positionsRes] = await Promise.all([
      portfolioApi.getBalance(),
      portfolioApi.getPositions(undefined, 100, 'position'),
    ]);
    
    state.balance = balanceRes.data.balance || 0;
    state.positions = (positionsRes.data.market_positions || []).map((p: MarketPosition) => ({
      ticker: p.ticker || '',
      position: p.position || 0,
      market_exposure: p.market_exposure || 0,
    }));
    state.isConnected = true;
  } catch (err) {
    // Silently fail
  }
}

/**
 * Render the entire UI
 */
function render() {
  const { rows, cols } = getTerminalSize();
  
  // Clear screen completely before rendering
  screen.clear();
  cursor.home();
  
  // Layout calculations
  const headerHeight = 4;
  const footerHeight = 3;
  const contentHeight = rows - headerHeight - footerHeight;
  const leftWidth = Math.floor(cols / 2);
  const rightWidth = cols - leftWidth;
  const topPanelHeight = Math.floor(contentHeight * 0.7);
  const bottomPanelHeight = contentHeight - topPanelHeight;

  // Render header
  renderHeader(1, 1, cols, headerHeight);
  
  // Render main panels
  renderMarkets(headerHeight + 1, 1, leftWidth, topPanelHeight);
  renderOrderbook(headerHeight + 1, leftWidth + 1, rightWidth, contentHeight); // Full height
  renderPositions(headerHeight + topPanelHeight + 1, 1, leftWidth, bottomPanelHeight);
  // Quick Trade removed - will add later
  
  // Render footer
  renderFooter(rows - footerHeight + 1, 1, cols, footerHeight);
}

/**
 * Render header
 */
function renderHeader(row: number, col: number, width: number, height: number) {
  drawBox(row, col, width, height, color.gray);
  
  // Branding
  writeAt(row + 1, col + 2, `${color.green}${color.bold}█ KALSHI${color.reset}`);
  writeAt(row + 2, col + 2, `${color.gray}NEW YORK COMPUTE${color.reset}`);
  
  // Balance and status (right side)
  const balanceText = state.balance !== null ? formatCurrency(state.balance) : '—';
  const statusColor = state.isConnected ? color.green : color.red;
  const statusIcon = state.isConnected ? '●' : '○';
  const statusText = state.isConnected ? 'connected' : 'disconnected';
  
  writeAt(row + 1, col + width - 20, `Balance: ${color.bold}${balanceText}${color.reset}`);
  writeAt(row + 2, col + width - 20, `${statusColor}${statusIcon}${color.reset} ${color.gray}${statusText}${color.reset}`);
}

/**
 * Render markets panel
 */
function renderMarkets(row: number, col: number, width: number, height: number) {
  const isActive = true; // TODO: track active panel
  const borderColor = isActive ? color.green : color.gray;
  
  drawBox(row, col, width, height, borderColor);
  
  // Title
  writeAt(row, col + 2, `${borderColor}${color.bold} MARKETS ${color.reset}`);
  
  // Markets list
  const visibleRows = height - 4;
  const startIdx = Math.max(0, state.selectedMarketIndex - Math.floor(visibleRows / 2));
  
  for (let i = 0; i < visibleRows && startIdx + i < state.markets.length; i++) {
    const market = state.markets[startIdx + i];
    const isSelected = startIdx + i === state.selectedMarketIndex;
    const lineRow = row + 2 + i;
    
    // Clear line first
    writeAt(lineRow, col + 1, ' '.repeat(width - 2));
    
    // Market ticker
    const ticker = truncate(market.ticker, 20);
    const price = formatPrice(market.yes_bid ?? 0);
    
    if (isSelected) {
      writeAt(lineRow, col + 2, `${color.green}${color.bold}${padRight(ticker, 22)}${color.reset}`);
    } else {
      writeAt(lineRow, col + 2, padRight(ticker, 22));
    }
    
    writeAt(lineRow, col + width - 12, `${price} ${color.gray}━${color.reset} +0`);
  }
  
  // Scroll indicator
  if (state.markets.length > 0) {
    const indicator = `${state.selectedMarketIndex + 1} of ${state.markets.length}`;
    writeAt(row + height - 2, col + Math.floor((width - indicator.length) / 2), `${color.gray}${indicator}${color.reset}`);
  }
}

/**
 * Render orderbook panel
 */
function renderOrderbook(row: number, col: number, width: number, height: number) {
  drawBox(row, col, width, height, color.gray);
  
  const selectedTicker = state.markets[state.selectedMarketIndex]?.ticker || '';
  writeAt(row, col + 2, `${color.bold} ORDERBOOK${color.reset}${color.gray}: ${selectedTicker} ${color.reset}`);
  
  if (!state.orderbook) {
    writeAt(row + 2, col + 2, `${color.gray}Select a market to view orderbook${color.reset}`);
    return;
  }
  
  // Asks (top)
  const asks = (state.orderbook.no || []).slice(0, 5).sort((a, b) => b[0] - a[0]);
  asks.forEach(([price, qty], i) => {
    const lineRow = row + 2 + i;
    writeAt(lineRow, col + 2, `${color.gray}ASK${color.reset}`);
    const barWidth = Math.min(Math.floor(qty / 1000), 20);
    writeAt(lineRow, col + 10, `${color.red}${'█'.repeat(barWidth)}${color.reset}`);
    writeAt(lineRow, col + width - 18, `${color.red}${formatPrice(100 - price)}${color.reset}`);
    writeAt(lineRow, col + width - 8, `${color.gray}(${qty})${color.reset}`);
  });
  
  // Spread
  const spreadRow = row + 8;
  writeAt(spreadRow, col + 2, `${color.gray}${'─'.repeat(width - 4)}${color.reset}`);
  
  // Bids (bottom)
  const bids = (state.orderbook.yes || []).slice(0, 5).sort((a, b) => b[0] - a[0]);
  bids.forEach(([price, qty], i) => {
    const lineRow = row + 10 + i;
    writeAt(lineRow, col + 2, `${color.gray}BID${color.reset}`);
    const barWidth = Math.min(Math.floor(qty / 1000), 20);
    writeAt(lineRow, col + 10, `${color.green}${'█'.repeat(barWidth)}${color.reset}`);
    writeAt(lineRow, col + width - 18, `${color.green}${formatPrice(price)}${color.reset}`);
    writeAt(lineRow, col + width - 8, `${color.gray}(${qty})${color.reset}`);
  });
}

/**
 * Render positions panel
 */
function renderPositions(row: number, col: number, width: number, height: number) {
  drawBox(row, col, width, height, color.gray);
  writeAt(row, col + 2, `${color.bold} POSITIONS ${color.reset}`);
  
  if (state.positions.length === 0) {
    writeAt(row + 2, col + 2, `${color.gray}No open positions${color.reset}`);
  } else {
    state.positions.slice(0, height - 3).forEach((pos, i) => {
      const lineRow = row + 2 + i;
      writeAt(lineRow, col + 2, truncate(pos.ticker, 18));
      const side = pos.position > 0 ? 'YES' : 'NO';
      const sideColor = pos.position > 0 ? color.green : color.red;
      writeAt(lineRow, col + width - 20, `${sideColor}${Math.abs(pos.position)} ${side}${color.reset}`);
      writeAt(lineRow, col + width - 10, formatCurrency(pos.market_exposure));
    });
  }
}


/**
 * Render footer
 */
function renderFooter(row: number, col: number, width: number, height: number) {
  drawBox(row, col, width, height, color.gray);
  writeAt(row + 1, col + 2, `Built by ${color.bold}New York Compute${color.reset} • ${color.green}newyorkcompute.xyz${color.reset}`);
  writeAt(row + 1, col + width - 22, `${color.gray}[?] Help [q] Quit${color.reset}`);
}

/**
 * Handle keyboard input
 */
function setupKeyboardInput() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    if (!key) return; // Ignore if no key info
    
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      cleanup();
      process.exit(0);
    }
    
    if (key.name === 'up') {
      state.selectedMarketIndex = Math.max(0, state.selectedMarketIndex - 1);
      safeRender();
    }
    
    if (key.name === 'down') {
      state.selectedMarketIndex = Math.min(state.markets.length - 1, state.selectedMarketIndex + 1);
      safeRender();
    }
  });
}

/**
 * Cleanup on exit
 */
function cleanup() {
  cursor.show();
  screen.exitAlt();
  
  if (marketsInterval) clearInterval(marketsInterval);
  if (orderbookInterval) clearInterval(orderbookInterval);
  if (portfolioInterval) clearInterval(portfolioInterval);
}

/**
 * Start the application
 */
export async function startApp() {
  // Setup terminal
  screen.enterAlt();
  screen.clear();
  cursor.hide();
  
  // Handle exit
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  
  // Handle terminal resize
  process.stdout.on('resize', () => {
    safeRender();
  });
  
  // Initialize client
  if (!initClient()) {
    console.error(state.error);
    cleanup();
    process.exit(1);
  }
  
  // Initial render
  render();
  
  // Setup keyboard
  setupKeyboardInput();
  
  // Start polling (staggered to avoid rate limits)
  await fetchMarkets();
  safeRender();
  
  setTimeout(async () => {
    await fetchOrderbook();
    safeRender();
  }, 500);
  
  setTimeout(async () => {
    await fetchPortfolio();
    safeRender();
  }, 1000);
  
  // Polling intervals
  marketsInterval = setInterval(async () => {
    await fetchMarkets();
    safeRender();
  }, 60000);
  
  orderbookInterval = setInterval(async () => {
    await fetchOrderbook();
    safeRender();
  }, 30000);
  
  portfolioInterval = setInterval(async () => {
    await fetchPortfolio();
    safeRender();
  }, 30000);
}

