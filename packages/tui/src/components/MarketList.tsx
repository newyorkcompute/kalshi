import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { formatPrice, truncate } from "@newyorkcompute/kalshi-core";
import { useMarkets } from "../hooks/useMarkets.js";
import { useAppStore } from "../stores/app-store.js";

/**
 * Market list panel with scrollable market data
 */
export function MarketList() {
  const { markets, isLoading, error } = useMarkets();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const setSelectedMarket = useAppStore((state) => state.setSelectedMarket);
  const activePanel = useAppStore((state) => state.activePanel);
  const searchQuery = useAppStore((state) => state.searchQuery);

  const isActive = activePanel === "markets";
  const visibleRows = 8;

  // Filter markets by search query
  const filteredMarkets = markets.filter(
    (m) =>
      m.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.upArrow) {
        const newIndex = Math.max(0, selectedIndex - 1);
        setSelectedIndex(newIndex);
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        if (filteredMarkets[newIndex]) {
          setSelectedMarket(filteredMarkets[newIndex].ticker || null);
        }
      }

      if (key.downArrow) {
        const newIndex = Math.min(filteredMarkets.length - 1, selectedIndex + 1);
        setSelectedIndex(newIndex);
        if (newIndex >= scrollOffset + visibleRows) {
          setScrollOffset(newIndex - visibleRows + 1);
        }
        if (filteredMarkets[newIndex]) {
          setSelectedMarket(filteredMarkets[newIndex].ticker || null);
        }
      }

      if (key.return && filteredMarkets[selectedIndex]) {
        setSelectedMarket(filteredMarkets[selectedIndex].ticker || null);
      }
    },
    { isActive }
  );

  // Select first market on initial load
  React.useEffect(() => {
    if (filteredMarkets.length > 0 && !useAppStore.getState().selectedMarket) {
      setSelectedMarket(filteredMarkets[0].ticker || null);
    }
  }, [filteredMarkets, setSelectedMarket]);

  const visibleMarkets = filteredMarkets.slice(
    scrollOffset,
    scrollOffset + visibleRows
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? "green" : "gray"}
      flexGrow={1}
    >
      {/* Panel header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color={isActive ? "green" : "white"}>
          MARKETS
        </Text>
        <Text color="gray" dimColor>
          [F1]
        </Text>
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(40)}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {isLoading && (
          <Text color="gray">Loading markets...</Text>
        )}

        {error && (
          <Text color="red">{error}</Text>
        )}

        {!isLoading && !error && filteredMarkets.length === 0 && (
          <Text color="gray">No markets found</Text>
        )}

        {visibleMarkets.map((market, index) => {
          const actualIndex = scrollOffset + index;
          const isSelected = actualIndex === selectedIndex;
          const yesBid = market.yes_bid ?? 0;
          
          // Calculate price change (mock for now - would need historical data)
          const change = 0;
          const changeColor = change > 0 ? "green" : change < 0 ? "red" : "gray";
          const changeSymbol = change > 0 ? "▲" : change < 0 ? "▼" : "━";

          return (
            <Box key={market.ticker} justifyContent="space-between">
              <Text
                color={isSelected ? "green" : "white"}
                bold={isSelected}
                inverse={isSelected}
              >
                {" "}
                {truncate(market.ticker || "", 20)}
              </Text>
              <Box>
                <Text color="white">{formatPrice(yesBid)}</Text>
                <Text color={changeColor}>
                  {" "}
                  {changeSymbol} {change >= 0 ? "+" : ""}
                  {change}
                </Text>
              </Box>
            </Box>
          );
        })}

        {/* Scroll indicator */}
        {filteredMarkets.length > visibleRows && (
          <Box justifyContent="center" marginTop={1}>
            <Text color="gray" dimColor>
              {scrollOffset + 1}-{Math.min(scrollOffset + visibleRows, filteredMarkets.length)} of{" "}
              {filteredMarkets.length}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

