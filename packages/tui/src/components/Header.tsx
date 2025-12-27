/**
 * Header Component
 * Displays branding, balance, connection status, and last update time
 */

import { Box, Text } from 'ink';

interface HeaderProps {
  balance: number | null;
  isConnected: boolean;
  isRateLimited?: boolean;
  isOffline?: boolean;
  error: string | null;
  lastUpdateTime?: number | null;
}

/**
 * Format a timestamp as relative time (e.g., "30s ago", "5m ago")
 * Returns null if data is fresh (< 30 seconds)
 */
function formatLastUpdate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  // Don't show anything if data is fresh
  if (seconds < 30) return null;
  
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function Header({ 
  balance, 
  isConnected, 
  isRateLimited, 
  isOffline,
  error,
  lastUpdateTime,
}: HeaderProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const balanceText = balance !== null ? formatCurrency(balance) : '—';

  // Determine connection status display
  const getStatusDisplay = () => {
    if (isOffline) {
      return { color: 'red' as const, icon: '⊘', text: 'offline' };
    }
    if (isRateLimited) {
      return { color: 'yellow' as const, icon: '◐', text: 'rate limited' };
    }
    if (isConnected) {
      return { color: 'green' as const, icon: '●', text: 'connected' };
    }
    return { color: 'red' as const, icon: '○', text: 'disconnected' };
  };

  const status = getStatusDisplay();
  const lastUpdate = formatLastUpdate(lastUpdateTime);

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
          {/* Show timestamp when offline OR when data is stale (> 30s) */}
          {(isOffline || lastUpdate) && (
            <Text color="gray" dimColor> · {lastUpdate || 'stale'}</Text>
          )}
        </Box>
        {error && (
          <Text color="yellow" dimColor wrap="truncate">{error.slice(0, 40)}…</Text>
        )}
      </Box>
    </Box>
  );
}
