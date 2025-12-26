/**
 * Orderbook Component
 * Visual depth chart showing bids and asks with spread indicator
 */

import { Box, Text } from 'ink';

interface OrderbookLevel {
  price: number;
  quantity: number;
}

interface OrderbookData {
  yes: [number, number][];
  no: [number, number][];
}

interface SelectedMarket {
  ticker: string;
  title: string;
  close_time?: string;
  volume?: number;
}

interface OrderbookProps {
  market: SelectedMarket | null;
  orderbook: OrderbookData | null;
  height: number;
}

/**
 * Format close time as relative time
 */
function formatExpiry(closeTime?: string): string {
  if (!closeTime) return '';
  
  const now = new Date();
  const close = new Date(closeTime);
  const diffMs = close.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'CLOSED';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

/**
 * Format volume with K/M suffix
 */
function formatVolume(volume?: number): string {
  if (!volume) return '';
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}

export function Orderbook({ market, orderbook, height }: OrderbookProps) {
  const formatPrice = (cents: number) => `${cents.toFixed(2)}¢`;
  
  // Parse orderbook into asks (no side, converted to YES equivalent) and bids (yes side)
  const asks: OrderbookLevel[] = (orderbook?.no ?? [])
    .slice(0, 5)
    .map(([price, qty]) => ({ price: 100 - price, quantity: qty }))
    .sort((a, b) => b.price - a.price);
    
  const bids: OrderbookLevel[] = (orderbook?.yes ?? [])
    .slice(0, 5)
    .map(([price, qty]) => ({ price, quantity: qty }))
    .sort((a, b) => b.price - a.price);

  // Calculate spread
  const bestAsk = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : null;
  const bestBid = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;

  // Calculate max quantity for bar scaling
  const maxQty = Math.max(
    ...asks.map(l => l.quantity),
    ...bids.map(l => l.quantity),
    1
  );

  const renderBar = (qty: number, color: string, maxWidth: number = 20) => {
    const barLength = Math.min(Math.floor((qty / maxQty) * maxWidth), maxWidth);
    return <Text color={color}>{'█'.repeat(barLength)}</Text>;
  };

  const expiry = formatExpiry(market?.close_time);
  const volume = formatVolume(market?.volume);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={height}
      width="100%"
    >
      {/* Title */}
      <Box paddingX={1} flexDirection="column">
        <Box>
          <Text bold> ORDERBOOK</Text>
          <Text color="gray">: {market?.ticker || 'Select a market'}</Text>
        </Box>
        {/* Market title (truncated) */}
        {market?.title && (
          <Text color="cyan" wrap="truncate">
            {market.title.slice(0, 50)}{market.title.length > 50 ? '…' : ''}
          </Text>
        )}
        {/* Expiry and volume */}
        {market && (
          <Box>
            {expiry && (
              <Text color="yellow">⏱ {expiry}</Text>
            )}
            {volume && (
              <Text color="gray">  Vol: {volume}</Text>
            )}
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {!orderbook ? (
          <Text color="gray">Select a market to view orderbook</Text>
        ) : (
          <>
            {/* Asks (top) */}
            {asks.map((level, i) => (
              <Box key={`ask-${i}`} justifyContent="space-between">
                <Box>
                  <Text color="gray">ASK </Text>
                  {renderBar(level.quantity, 'red')}
                </Box>
                <Box>
                  <Text color="red">{formatPrice(level.price)}</Text>
                  <Text color="gray"> ({level.quantity})</Text>
                </Box>
              </Box>
            ))}

            {/* Spread line */}
            <Box marginY={1} justifyContent="space-between">
              <Text color="gray">{'─'.repeat(30)}</Text>
              {spread !== null && (
                <Text color="yellow" bold>
                  SPREAD: {spread.toFixed(2)}¢
                </Text>
              )}
            </Box>

            {/* Bids (bottom) */}
            {bids.map((level, i) => (
              <Box key={`bid-${i}`} justifyContent="space-between">
                <Box>
                  <Text color="gray">BID </Text>
                  {renderBar(level.quantity, 'green')}
                </Box>
                <Box>
                  <Text color="green">{formatPrice(level.price)}</Text>
                  <Text color="gray"> ({level.quantity})</Text>
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}
