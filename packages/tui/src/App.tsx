/**
 * Kalshi TUI - Main Application
 * Clean, minimal, beautiful terminal trading
 */

import { Box, useApp, useInput, useStdout } from 'ink';
import { useState, useEffect, useMemo } from 'react';

/** Available sort options for markets list */
export type SortOption = 'volume' | 'volume_24h' | 'open_interest' | 'price';

const SORT_OPTIONS: SortOption[] = ['volume', 'volume_24h', 'open_interest', 'price'];
import { Header } from './components/Header.js';
import { Markets } from './components/Markets.js';
import { Orderbook } from './components/Orderbook.js';
import { Positions } from './components/Positions.js';
import { Arbitrage } from './components/Arbitrage.js';
import { Footer } from './components/Footer.js';
import { PriceChart } from './components/PriceChart.js';
import { useKalshi } from './hooks/useKalshi.js';

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>('volume');

  // Get terminal dimensions
  const width = stdout?.columns ?? 120;
  const height = stdout?.rows ?? 40;

  // Fetch data from Kalshi
  const { 
    markets: rawMarkets, 
    orderbook, 
    balance, 
    positions, 
    isConnected,
    isRateLimited,
    isOffline,
    isRealtime,
    error,
    selectMarket,
    priceHistory,
    loading,
    lastUpdateTime,
    arbitrage,
  } = useKalshi();

  // Sort markets based on selected option
  const markets = useMemo(() => {
    const sorted = [...rawMarkets];
    switch (sortOption) {
      case 'volume':
        sorted.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        break;
      case 'volume_24h':
        sorted.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
        break;
      case 'open_interest':
        sorted.sort((a, b) => (b.open_interest || 0) - (a.open_interest || 0));
        break;
      case 'price':
        sorted.sort((a, b) => (b.yes_bid || 0) - (a.yes_bid || 0));
        break;
    }
    return sorted;
  }, [rawMarkets, sortOption]);

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

    // Cycle sort option with 's' key
    if (input === 's') {
      setSortOption(current => {
        const currentIndex = SORT_OPTIONS.indexOf(current);
        const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
        return SORT_OPTIONS[nextIndex];
      });
      // Reset selection to top when sort changes
      setSelectedIndex(0);
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
  
  // Left column: Markets (50%) → Arbitrage (25%) → Positions (25%)
  const marketsHeight = Math.floor(contentHeight * 0.50);
  const arbitrageHeight = Math.floor(contentHeight * 0.25);
  const positionsHeight = contentHeight - marketsHeight - arbitrageHeight;
  
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
        isOffline={isOffline}
        isRealtime={isRealtime}
        error={error}
        lastUpdateTime={lastUpdateTime}
      />

      {/* Main Content */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Left Column: Markets + Arbitrage + Positions */}
        <Box flexDirection="column" width={leftWidth}>
          <Markets
            markets={markets}
            selectedIndex={selectedIndex}
            height={marketsHeight}
            isLoading={loading.markets}
            sortBy={sortOption}
          />
          <Arbitrage
            opportunities={arbitrage}
            height={arbitrageHeight}
            isLoading={loading.markets}
          />
          <Positions 
            positions={positions} 
            height={positionsHeight}
            isLoading={loading.portfolio}
          />
        </Box>

        {/* Right Column: Orderbook + Chart */}
        <Box flexDirection="column" flexGrow={1}>
          <Orderbook
            market={selectedMarket}
            orderbook={orderbook}
            height={orderbookHeight}
            isLoading={loading.orderbook}
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
