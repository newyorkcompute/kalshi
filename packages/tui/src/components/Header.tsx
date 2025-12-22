import React from "react";
import { Box, Text } from "ink";
import { formatCurrency } from "@newyorkcompute/kalshi-core";
import { usePortfolio } from "../hooks/usePortfolio.js";
import { useAppStore } from "../stores/app-store.js";

/**
 * Header component with branding and balance
 */
export function Header() {
  const { balance } = usePortfolio();
  const isConnected = useAppStore((state) => state.isConnected);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left: Branding */}
      <Box flexDirection="column">
        <Box>
          <Text color="green" bold>
            ▓
          </Text>
          <Text bold> KALSHI</Text>
        </Box>
        <Text color="gray" dimColor>
          NEW YORK COMPUTE
        </Text>
      </Box>

      {/* Right: Balance and connection status */}
      <Box flexDirection="column" alignItems="flex-end">
        <Box>
          <Text>Balance: </Text>
          <Text color="white" bold>
            {balance ? formatCurrency(balance.balance) : "—"}
          </Text>
        </Box>
        <Box>
          <Text color={isConnected ? "green" : "red"}>
            {isConnected ? "◉" : "○"}
          </Text>
          <Text color="gray" dimColor>
            {" "}
            {isConnected ? "connected" : "disconnected"}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

