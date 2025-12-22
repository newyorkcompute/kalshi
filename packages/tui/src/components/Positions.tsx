import React from "react";
import { Box, Text } from "ink";
import { formatCurrency, truncate } from "@newyorkcompute/kalshi-core";
import { usePortfolio } from "../hooks/usePortfolio.js";
import { useAppStore } from "../stores/app-store.js";

/**
 * Positions panel showing current holdings
 */
export function Positions() {
  const { positions, isLoading, error } = usePortfolio();
  const activePanel = useAppStore((state) => state.activePanel);
  const isActive = activePanel === "positions";

  // Calculate total exposure
  const totalExposure = positions.reduce(
    (sum, pos) => sum + pos.market_exposure,
    0
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? "green" : "gray"}
      height={10}
    >
      {/* Panel header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color={isActive ? "green" : "white"}>
          POSITIONS
        </Text>
        <Text color="gray" dimColor>
          [F3]
        </Text>
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(40)}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {isLoading && <Text color="gray">Loading positions...</Text>}

        {error && <Text color="red">{error}</Text>}

        {!isLoading && !error && positions.length === 0 && (
          <Text color="gray">No open positions</Text>
        )}

        {positions.slice(0, 4).map((position) => {
          const side = position.position > 0 ? "YES" : "NO";
          const quantity = Math.abs(position.position);
          const exposure = position.market_exposure;

          return (
            <Box key={position.ticker} justifyContent="space-between">
              <Text color="white">
                {truncate(position.ticker, 18)}
              </Text>
              <Box>
                <Text color={side === "YES" ? "green" : "red"}>
                  {side === "YES" ? "+" : "-"}
                  {quantity}
                </Text>
                <Text color="gray"> {side}</Text>
              </Box>
              <Text color="white">{formatCurrency(exposure)}</Text>
            </Box>
          );
        })}

        {/* Total exposure */}
        {positions.length > 0 && (
          <Box marginTop={1} justifyContent="space-between">
            <Text color="gray">Total Exposure:</Text>
            <Text color="white" bold>
              {formatCurrency(totalExposure)}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

