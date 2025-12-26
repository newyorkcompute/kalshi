/**
 * Kalshi TUI - Main Application
 * Clean, minimal, beautiful terminal trading
 */

import { Box, useApp, useInput, useStdout } from 'ink';
import { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { Markets } from './components/Markets.js';
import { Orderbook } from './components/Orderbook.js';
import { Positions } from './components/Positions.js';
import { Footer } from './components/Footer.js';
import { PriceChart } from './components/PriceChart.js';
import { useKalshi } from './hooks/useKalshi.js';

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get terminal dimensions
  const width = stdout?.columns ?? 120;
  const height = stdout?.rows ?? 40;

  // Fetch data from Kalshi
  const { 
    markets, 
    orderbook, 
    balance, 
    positions, 
    isConnected,
    isRateLimited,
    error,
    selectMarket,
    priceHistory,
  } = useKalshi();

  // Update orderbook when selection changes
  useEffect(() => {
    const ticker = markets[selectedIndex]?.ticker;
    if (ticker) {
      selectMarket(ticker);
    }
  }, [selectedIndex, markets, selectMarket]);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'q') {
      exit();
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    }

    if (key.downArrow) {
      setSelectedIndex(i => Math.min(markets.length - 1, i + 1));
    }
  });

  // Layout calculations
  const leftWidth = Math.floor(width / 2);
  const rightWidth = width - leftWidth;
  const contentHeight = height - 6; // Header (3) + Footer (3)
  const marketsHeight = Math.floor(contentHeight * 0.65);
  const positionsHeight = contentHeight - marketsHeight;
  
  // Right column split: Orderbook (top) + Chart (bottom)
  const orderbookHeight = Math.floor(contentHeight * 0.55);
  const chartHeight = contentHeight - orderbookHeight;

  // Get selected market for orderbook/chart
  const selectedMarket = markets[selectedIndex] ?? null;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header */}
      <Header 
        balance={balance} 
        isConnected={isConnected}
        isRateLimited={isRateLimited}
        error={error}
      />

      {/* Main Content */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Left Column: Markets + Positions */}
        <Box flexDirection="column" width={leftWidth}>
          <Markets
            markets={markets}
            selectedIndex={selectedIndex}
            height={marketsHeight}
          />
          <Positions 
            positions={positions} 
            height={positionsHeight}
          />
        </Box>

        {/* Right Column: Orderbook + Chart */}
        <Box flexDirection="column" flexGrow={1}>
          <Orderbook
            market={selectedMarket}
            orderbook={orderbook}
            height={orderbookHeight}
          />
          <PriceChart
            ticker={selectedMarket?.ticker ?? null}
            priceHistory={priceHistory}
            height={chartHeight}
            width={rightWidth}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
}
