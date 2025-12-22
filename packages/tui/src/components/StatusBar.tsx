import React from "react";
import { Box, Text } from "ink";

/**
 * Status bar with keybindings and NYC branding
 */
export function StatusBar() {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left: NYC branding */}
      <Box>
        <Text color="gray">Built by </Text>
        <Text color="white">New York Compute</Text>
        <Text color="gray"> • </Text>
        <Text color="green">newyorkcompute.xyz</Text>
      </Box>

      {/* Right: Key bindings */}
      <Box>
        <Text color="gray">[?] Help</Text>
        <Text color="gray"> </Text>
        <Text color="gray">[q] Quit</Text>
      </Box>
    </Box>
  );
}

