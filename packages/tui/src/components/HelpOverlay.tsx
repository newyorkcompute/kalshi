/**
 * Help Overlay Component
 * Shows keyboard shortcuts as a centered modal overlay
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
  const modalWidth = 48;
  const modalHeight = SHORTCUTS.length + 6;
  
  // Calculate centering offsets
  const topPadding = Math.max(0, Math.floor((height - modalHeight) / 2));
  const leftPadding = Math.max(0, Math.floor((width - modalWidth) / 2));

  return (
    <Box
      position="absolute"
      marginTop={topPadding}
      marginLeft={leftPadding}
      flexDirection="column"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        width={modalWidth}
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
          <Box key={key} justifyContent="space-between" width={modalWidth - 6}>
            <Text color="yellow" bold>{key}</Text>
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
