/**
 * Help Overlay Component
 * Modal overlay with dimmed background
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
  const modalWidth = 52;
  const modalHeight = SHORTCUTS.length + 6;
  
  // Calculate centering
  const topPad = Math.floor((height - modalHeight) / 2);
  const leftPad = Math.floor((width - modalWidth) / 2);

  // Create dimmed background rows
  const bgRows = Array(height).fill(null);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Dimmed background overlay */}
      {bgRows.map((_, i) => (
        <Box key={i} width={width}>
          <Text color="gray" dimColor>
            {'░'.repeat(width)}
          </Text>
        </Box>
      ))}
      
      {/* Modal positioned absolutely on top */}
      <Box
        position="absolute"
        marginTop={topPad}
        marginLeft={leftPad}
      >
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="cyan"
          width={modalWidth}
          paddingX={3}
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
            <Text color="gray">Press any key to close</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
