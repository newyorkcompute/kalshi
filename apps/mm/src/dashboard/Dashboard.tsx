/**
 * Dashboard - Main layout component for the MM bot terminal dashboard.
 */

import React, { useState, useEffect } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { useBot } from "./useBot.js";
import {
  StatusBar,
  PnLBar,
  PositionsPanel,
  RiskPanel,
  MarketsPanel,
  HelpBar,
  OfflineScreen,
} from "./components.js";

/** Hook to track terminal height, updating on resize */
function useTerminalHeight(): number {
  const { stdout } = useStdout();
  const [height, setHeight] = useState(stdout?.rows ?? 24);

  useEffect(() => {
    const onResize = (): void => {
      setHeight(stdout?.rows ?? 24);
    };
    stdout?.on("resize", onResize);
    return () => {
      stdout?.off("resize", onResize);
    };
  }, [stdout]);

  return height;
}

interface DashboardProps {
  port?: number;
}

export function Dashboard({ port = 3001 }: DashboardProps): React.ReactElement {
  const { state, markets, metrics, online, lastUpdate, error, sendCommand } =
    useBot(port, 2000);
  const { exit } = useApp();
  const termHeight = useTerminalHeight();

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    }
    if (input === "p") sendCommand("pause");
    if (input === "r") sendCommand("resume");
    if (input === "f") sendCommand("flatten");
    if (input === "s") sendCommand("scan");
  });

  // Fixed-height wrapper prevents stale lines when content shrinks between renders.
  // Ink overwrites the exact same region every frame so nothing leaks.
  const wrapper = (children: React.ReactNode): React.ReactElement => (
    <Box flexDirection="column" height={termHeight}>
      {children}
    </Box>
  );

  // Offline state
  if (!online || !state) {
    return wrapper(
      <>
        <StatusBar state={null} online={false} lastUpdate={lastUpdate} />
        <OfflineScreen error={error} port={port} />
        <Box flexGrow={1} />
        <HelpBar />
      </>,
    );
  }

  return wrapper(
    <>
      {/* Header */}
      <StatusBar state={state} online={online} lastUpdate={lastUpdate} />

      {/* P&L Summary Bar */}
      <PnLBar state={state} metrics={metrics} />

      {/* Middle: Positions + Risk side by side */}
      <Box borderStyle="single" paddingX={1}>
        <PositionsPanel positions={state.positions} />
        <RiskPanel state={state} />
      </Box>

      {/* Markets */}
      <Box borderStyle="single" paddingX={1} flexGrow={1}>
        <MarketsPanel markets={markets} />
      </Box>

      {/* Help */}
      <HelpBar />
    </>,
  );
}
