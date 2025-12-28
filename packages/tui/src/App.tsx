/**
 * Kalshi TUI - Main Application
 * Clean, minimal, beautiful terminal trading
 */

import { Box, useApp, useInput, useStdout } from 'ink';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header.js';
import { Markets } from './components/Markets.js';
import { Orderbook } from './components/Orderbook.js';
import { Positions } from './components/Positions.js';
import { Arbitrage } from './components/Arbitrage.js';
import { Footer } from './components/Footer.js';
import { PriceChart } from './components/PriceChart.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { useKalshi } from './hooks/useKalshi.js';
import { 
  loadConfig, 
  saveConfig, 
  toggleFavorite, 
  type SortOption, 
  type TuiConfig 
} from './config.js';

const SORT_OPTIONS: SortOption[] = ['volume', 'volume_24h', 'open_interest', 'price'];

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  
  // Load config from disk on startup
  const [config, setConfig] = useState<TuiConfig>(() => loadConfig());
  
  // Save config whenever it changes
  const updateConfig = useCallback((updates: Partial<TuiConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

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

  // Sort markets based on selected option, with favorites first
  const markets = useMemo(() => {
    const sorted = [...rawMarkets];
    
    // First sort by the selected option
    switch (config.sortBy) {
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
    
    // Then put favorites at top if enabled
    if (config.favoritesFirst && config.favorites.length > 0) {
      sorted.sort((a, b) => {
        const aFav = config.favorites.includes(a.ticker) ? 1 : 0;
        const bFav = config.favorites.includes(b.ticker) ? 1 : 0;
        return bFav - aFav; // Favorites first
      });
    }
    
    return sorted;
  }, [rawMarkets, config.sortBy, config.favorites, config.favoritesFirst]);

  // Update orderbook when selection changes
  useEffect(() => {
    const ticker = markets[selectedIndex]?.ticker;
    if (ticker) {
      selectMarket(ticker);
    }
  }, [selectedIndex, markets, selectMarket]);

  // Handle keyboard input
  useInput((input, key) => {
    // Toggle help overlay with '?' or 'h'
    if (input === '?' || input === 'h') {
      setShowHelp(prev => !prev);
      return;
    }

    // When help is shown, any key closes it
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    if (input === 'q') {
      exit();
    }

    // Cycle sort option with 's' key
    if (input === 's') {
      const currentIndex = SORT_OPTIONS.indexOf(config.sortBy);
      const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
      updateConfig({ sortBy: SORT_OPTIONS[nextIndex] });
      // Reset selection to top when sort changes
      setSelectedIndex(0);
    }

    // Toggle favorite with 'f' key
    if (input === 'f') {
      const selectedTicker = markets[selectedIndex]?.ticker;
      if (selectedTicker) {
        updateConfig({ 
          favorites: toggleFavorite(config.favorites, selectedTicker) 
        });
      }
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

  // Show help overlay (with dimmed background pattern)
  if (showHelp) {
    return <HelpOverlay width={width} height={height} />;
  }

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
            sortBy={config.sortBy}
            favorites={config.favorites}
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
