/**
 * Header Component
 * Displays branding, balance, and connection status
 */

import { Box, Text } from 'ink';

interface HeaderProps {
  balance: number | null;
  isConnected: boolean;
  error: string | null;
}

export function Header({ balance, isConnected, error }: HeaderProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const balanceText = balance !== null ? formatCurrency(balance) : '—';

  return (
    <Box 
      flexDirection="row" 
      justifyContent="space-between" 
      borderStyle="single" 
      borderColor="gray"
      paddingX={1}
      height={3}
    >
      {/* Branding */}
      <Box flexDirection="column">
        <Text color="green" bold>█ KALSHI</Text>
        <Text color="gray">NEW YORK COMPUTE</Text>
      </Box>

      {/* Status */}
      <Box flexDirection="column" alignItems="flex-end">
        <Text>
          Balance: <Text bold>{balanceText}</Text>
        </Text>
        <Box>
          <Text color={isConnected ? 'green' : 'red'}>
            {isConnected ? '●' : '○'}
          </Text>
          <Text color="gray"> {isConnected ? 'connected' : 'disconnected'}</Text>
        </Box>
        {error && (
          <Text color="red" dimColor>{error}</Text>
        )}
      </Box>
    </Box>
  );
}

