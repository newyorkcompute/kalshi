/**
 * Help Overlay Component
 * Clean full-screen help modal
 */

import { Box, Text } from 'ink';

interface HelpOverlayProps {
  width: number;
  height: number;
}

const SHORTCUTS = [
  { key: '↑ / ↓', description: 'Navigate markets' },
  { key: 's', description: 'Cycle sort (volume → 24h → OI → price)' },
  { key: 'f', description: 'Toggle favorite ★' },
  { key: 'h / ?', description: 'Toggle this help' },
  { key: 'q', description: 'Quit' },
];

export function HelpOverlay({ width, height }: HelpOverlayProps) {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={width}
      height={height}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={4}
        paddingY={1}
      >
        {/* Title */}
        <Box justifyContent="center" marginBottom={1}>
          <Text color="cyan" bold>
            ⌨️  KEYBOARD SHORTCUTS
          </Text>
        </Box>

        {/* Shortcuts list */}
        {SHORTCUTS.map(({ key, description }) => (
          <Box key={key}>
            <Box width={14}>
              <Text color="yellow" bold>{key}</Text>
            </Box>
            <Text color="white">{description}</Text>
          </Box>
        ))}

        {/* Footer hint */}
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>Press any key to close</Text>
        </Box>
      </Box>
    </Box>
  );
}
