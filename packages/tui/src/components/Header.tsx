/**
 * Header Component
 * Displays branding, balance, and connection status
 */

import { Box, Text } from 'ink';

interface HeaderProps {
  balance: number | null;
  isConnected: boolean;
  isRateLimited?: boolean;
  error: string | null;
}

export function Header({ balance, isConnected, isRateLimited, error }: HeaderProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const balanceText = balance !== null ? formatCurrency(balance) : '—';

  // Determine connection status display
  const getStatusDisplay = () => {
    if (isRateLimited) {
      return { color: 'yellow' as const, icon: '◐', text: 'rate limited' };
    }
    if (isConnected) {
      return { color: 'green' as const, icon: '●', text: 'connected' };
    }
    return { color: 'red' as const, icon: '○', text: 'disconnected' };
  };

  const status = getStatusDisplay();

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
      {/* Branding */}
      <Box flexDirection="column" flexGrow={1}>
        <Text color="green" bold>█ KALSHI</Text>
        <Text color="gray">NEW YORK COMPUTE</Text>
      </Box>

      {/* Status */}
      <Box flexDirection="column" alignItems="flex-end">
        <Text>
          Balance: <Text bold>{balanceText}</Text>
        </Text>
        <Box>
          <Text color={status.color}>
            {status.icon}
          </Text>
          <Text color="gray"> {status.text}</Text>
        </Box>
        {error && (
          <Text color="yellow" dimColor wrap="truncate">{error.slice(0, 40)}</Text>
        )}
      </Box>
    </Box>
  );
}
