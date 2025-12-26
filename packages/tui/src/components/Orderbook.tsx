/**
 * Orderbook Component
 * Visual depth chart showing bids and asks
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

interface OrderbookProps {
  ticker: string;
  orderbook: OrderbookData | null;
  height: number;
}

export function Orderbook({ ticker, orderbook, height }: OrderbookProps) {
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

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="gray"
      height={height}
    >
      {/* Title */}
      <Box paddingX={1}>
        <Text bold> ORDERBOOK</Text>
        <Text color="gray">: {ticker || 'Select a market'}</Text>
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
            <Box marginY={1}>
              <Text color="gray">{'─'.repeat(40)}</Text>
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

