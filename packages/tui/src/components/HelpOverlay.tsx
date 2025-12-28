/**
 * Help Overlay Component
 * Shows keyboard shortcuts when user presses '?'
 */

import { Box, Text } from 'ink';

interface HelpOverlayProps {
  width?: number;
  height?: number;
}

const SHORTCUTS = [
  { key: '↑ / ↓', description: 'Navigate markets' },
  { key: 's', description: 'Cycle sort (volume → 24h → OI → price)' },
  { key: 'f', description: 'Toggle favorite ★' },
  { key: 'h / ?', description: 'Toggle this help' },
  { key: 'q', description: 'Quit' },
];

export function HelpOverlay(_props: HelpOverlayProps) {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        paddingX={2}
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
            <Text color="yellow" bold>{key.padEnd(12)}</Text>
            <Text color="white">{description}</Text>
          </Box>
        ))}

        {/* Footer hint */}
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>Press ? to close</Text>
        </Box>
      </Box>
    </Box>
  );
}

