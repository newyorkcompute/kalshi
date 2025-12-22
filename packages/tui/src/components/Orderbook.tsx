import React from "react";
import { Box, Text } from "ink";
import { formatPrice } from "@newyorkcompute/kalshi-core";
import { useOrderbook } from "../hooks/useOrderbook.js";
import { useAppStore } from "../stores/app-store.js";

interface OrderbookProps {
  ticker: string | null;
}

/**
 * Orderbook visualization with depth bars
 */
export function Orderbook({ ticker }: OrderbookProps) {
  const { orderbook, isLoading, error } = useOrderbook(ticker);
  const activePanel = useAppStore((state) => state.activePanel);
  const isActive = activePanel === "orderbook";

  // Calculate max quantity for bar scaling
  const yesQtys = orderbook?.yes?.map((level) => level[1]) || [];
  const noQtys = orderbook?.no?.map((level) => level[1]) || [];
  const allQuantities = [...yesQtys, ...noQtys];
  const maxQty = Math.max(...allQuantities, 1);

  // Render a depth bar
  const renderBar = (quantity: number, side: "ask" | "bid", maxWidth = 20) => {
    const barWidth = Math.round((quantity / maxQty) * maxWidth);
    const bar = "█".repeat(barWidth);
    const padding = " ".repeat(maxWidth - barWidth);

    if (side === "ask") {
      return (
        <Text color="red">
          {padding}
          {bar}
        </Text>
      );
    } else {
      return <Text color="green">{bar}</Text>;
    }
  };

  // Get asks (sorted high to low) and bids (sorted high to low)
  const asks = (orderbook?.no || [])
    .slice(0, 5)
    .sort((a, b) => b[0] - a[0]);
  const bids = (orderbook?.yes || [])
    .slice(0, 5)
    .sort((a, b) => b[0] - a[0]);

  // Calculate spread
  const bestAsk = asks.length > 0 ? asks[asks.length - 1][0] : null;
  const bestBid = bids.length > 0 ? bids[0][0] : null;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? "green" : "gray"}
      flexGrow={1}
    >
      {/* Panel header */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color={isActive ? "green" : "white"}>
            ORDERBOOK
          </Text>
          {ticker && (
            <Text color="gray" dimColor>
              : {ticker}
            </Text>
          )}
        </Box>
        <Text color="gray" dimColor>
          [F2]
        </Text>
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(40)}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {!ticker && (
          <Text color="gray">Select a market to view orderbook</Text>
        )}

        {ticker && isLoading && (
          <Text color="gray">Loading orderbook...</Text>
        )}

        {ticker && error && <Text color="red">{error}</Text>}

        {ticker && orderbook && !isLoading && (
          <>
            {/* Asks (NO side, shown as asks) */}
            {asks.map(([price, qty], index) => (
              <Box key={`ask-${index}`} justifyContent="space-between">
                <Text color="gray">ASK</Text>
                {renderBar(qty, "ask")}
                <Text color="red">{formatPrice(100 - price)}</Text>
                <Text color="gray" dimColor>
                  ({qty})
                </Text>
              </Box>
            ))}

            {/* Spread line */}
            <Box justifyContent="center" marginY={1}>
              <Text color="gray">
                {"─── SPREAD: "}
                {spread !== null ? `${spread}¢` : "—"}
                {" ───"}
              </Text>
            </Box>

            {/* Bids (YES side) */}
            {bids.map(([price, qty], index) => (
              <Box key={`bid-${index}`} justifyContent="space-between">
                <Text color="gray">BID</Text>
                {renderBar(qty, "bid")}
                <Text color="green">{formatPrice(price)}</Text>
                <Text color="gray" dimColor>
                  ({qty})
                </Text>
              </Box>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

