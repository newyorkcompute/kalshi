import React from "react";
import { Box, Text, useInput } from "ink";
import { useAppStore } from "../stores/app-store.js";

/**
 * Help modal showing keybindings and commands
 */
export function HelpModal() {
  const showHelp = useAppStore((state) => state.showHelp);
  const toggleHelp = useAppStore((state) => state.toggleHelp);

  useInput((input, key) => {
    if (showHelp && (input === "?" || key.escape || input === "q")) {
      toggleHelp();
    }
  });

  if (!showHelp) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="green"
      padding={1}
      position="absolute"
      marginLeft={10}
      marginTop={5}
    >
      <Box marginBottom={1}>
        <Text color="green" bold>
          ▓ KALSHI TUI — HELP
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text color="white" bold>
          Navigation
        </Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>
            <Text color="green">↑ / ↓</Text>
            <Text color="gray"> — Navigate markets</Text>
          </Text>
          <Text>
            <Text color="green">Enter</Text>
            <Text color="gray"> — Select market</Text>
          </Text>
          <Text>
            <Text color="green">F1-F4</Text>
            <Text color="gray"> — Switch panels</Text>
          </Text>
          <Text>
            <Text color="green">/</Text>
            <Text color="gray"> — Search markets</Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color="white" bold>
            Trading
          </Text>
        </Box>
        <Box marginLeft={2} flexDirection="column">
          <Text>
            <Text color="green">Tab</Text>
            <Text color="gray"> — Toggle YES/NO side</Text>
          </Text>
          <Text>
            <Text color="green">[ / ]</Text>
            <Text color="gray"> — Adjust quantity</Text>
          </Text>
          <Text>
            <Text color="green">- / +</Text>
            <Text color="gray"> — Adjust price</Text>
          </Text>
          <Text>
            <Text color="green">Enter</Text>
            <Text color="gray"> — Place order</Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color="white" bold>
            General
          </Text>
        </Box>
        <Box marginLeft={2} flexDirection="column">
          <Text>
            <Text color="green">r</Text>
            <Text color="gray"> — Refresh data</Text>
          </Text>
          <Text>
            <Text color="green">?</Text>
            <Text color="gray"> — Toggle this help</Text>
          </Text>
          <Text>
            <Text color="green">q</Text>
            <Text color="gray"> — Quit</Text>
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text color="gray" dimColor>
          Press ? or Esc to close
        </Text>
      </Box>
    </Box>
  );
}

