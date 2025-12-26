/**
 * Footer Component
 * Branding and keyboard shortcuts
 */

import { Box, Text } from 'ink';

export function Footer() {
  return (
    <Box 
      flexDirection="row" 
      justifyContent="space-between"
      borderStyle="single" 
      borderColor="gray"
      paddingX={1}
      height={3}
      width="100%"
    >
      <Text>
        Built by <Text bold>New York Compute</Text> • <Text color="green">newyorkcompute.xyz</Text>
      </Text>
      <Text color="gray">[↑↓] Navigate [q] Quit</Text>
    </Box>
  );
}

