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
  // Calculate vertical padding to center the modal
  const modalHeight = SHORTCUTS.length + 7; // content + borders + padding
  const topPadding = Math.floor((height - modalHeight) / 2);

  return (
    <Box flexDirection="column" width={width}>
      {/* Top spacer */}
      {topPadding > 0 && <Box height={topPadding} />}
      
      {/* Centered modal */}
      <Box justifyContent="center">
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
    </Box>
  );
}
