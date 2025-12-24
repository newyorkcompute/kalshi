import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Header } from "./components/Header.js";
import { MarketList } from "./components/MarketList.js";
import { Orderbook } from "./components/Orderbook.js";
import { Positions } from "./components/Positions.js";
import { OrderEntry } from "./components/OrderEntry.js";
import { StatusBar } from "./components/StatusBar.js";
import { HelpModal } from "./components/HelpModal.js";
import { SearchBar } from "./components/SearchBar.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { useAppStore } from "./stores/app-store.js";
import { useKalshi } from "./hooks/useKalshi.js";

/**
 * Main application component (wrapped in ErrorBoundary)
 */
function AppContent() {
  const { exit } = useApp();
  const [error, setError] = useState<string | null>(null);
  const { isConfigured, configError } = useKalshi();
  const selectedMarket = useAppStore((state) => state.selectedMarket);

  // Handle keyboard input
  useInput((input, key) => {
    // Quit on 'q' or Ctrl+C
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
    }

    // Help on '?'
    if (input === "?") {
      useAppStore.getState().toggleHelp();
    }
  });

  // Check configuration on mount
  useEffect(() => {
    if (configError) {
      setError(configError);
    }
  }, [configError]);

  // Show error screen if not configured
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="red" bold>
            Configuration Error
          </Text>
        </Box>
        <Text color="gray">{error}</Text>
        <Box marginTop={1}>
          <Text color="gray">
            Set KALSHI_API_KEY and KALSHI_PRIVATE_KEY environment variables.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">
            Run `kalshi-tui --help` for more information.
          </Text>
        </Box>
      </Box>
    );
  }

  // Loading state
  if (!isConfigured) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">▓</Text>
        <Text> Connecting to Kalshi...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Header />

      {/* Search bar (when active) */}
      <SearchBar />

      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left column: Markets and Positions */}
        <Box flexDirection="column" width="50%">
          <MarketList />
          <Positions />
        </Box>

        {/* Right column: Orderbook and Order Entry */}
        <Box flexDirection="column" width="50%">
          <Orderbook ticker={selectedMarket} />
          <OrderEntry ticker={selectedMarket} />
        </Box>
      </Box>

      {/* Status bar */}
      <StatusBar />

      {/* Help modal (overlay) */}
      <HelpModal />
    </Box>
  );
}

/**
 * App component wrapped in ErrorBoundary
 */
export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

