/**
 * Price Chart Component
 * ASCII chart showing historical YES prices
 */

import { Box, Text } from 'ink';
import asciichart from 'asciichart';

interface TradePoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface PriceChartProps {
  ticker: string | null;
  priceHistory: TradePoint[];
  height: number;
  width: number;
}

/**
 * Aggregate trade points into time buckets for smoother charting
 */
function aggregatePrices(trades: TradePoint[], buckets: number): number[] {
  if (trades.length === 0) return [];
  if (trades.length === 1) return [trades[0].price];

  const minTime = trades[0].timestamp;
  const maxTime = trades[trades.length - 1].timestamp;
  const timeRange = maxTime - minTime;
  
  if (timeRange === 0) return [trades[0].price];

  const bucketSize = timeRange / buckets;
  const result: number[] = [];
  
  for (let i = 0; i < buckets; i++) {
    const bucketStart = minTime + (i * bucketSize);
    const bucketEnd = bucketStart + bucketSize;
    
    const bucketTrades = trades.filter(
      t => t.timestamp >= bucketStart && t.timestamp < bucketEnd
    );
    
    if (bucketTrades.length > 0) {
      // Use volume-weighted average price
      const totalVolume = bucketTrades.reduce((sum, t) => sum + t.volume, 0);
      const vwap = totalVolume > 0
        ? bucketTrades.reduce((sum, t) => sum + (t.price * t.volume), 0) / totalVolume
        : bucketTrades[bucketTrades.length - 1].price;
      result.push(vwap);
    } else if (result.length > 0) {
      // Fill gaps with last known price
      result.push(result[result.length - 1]);
    }
  }
  
  return result;
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

export function PriceChart({ ticker, priceHistory, height, width }: PriceChartProps) {
  // Calculate chart dimensions
  const chartHeight = Math.max(height - 8, 5); // Leave room for labels
  const chartWidth = Math.max(width - 15, 20); // Leave room for Y-axis labels

  // Aggregate prices into chart-friendly format
  const prices = aggregatePrices(priceHistory, Math.min(chartWidth, priceHistory.length));

  // Calculate stats
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : null;
  const startPrice = prices.length > 0 ? prices[0] : null;
  const priceChange = currentPrice && startPrice 
    ? ((currentPrice - startPrice) / startPrice * 100).toFixed(2)
    : null;
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  // Generate chart
  let chartOutput = '';
  if (prices.length >= 2) {
    try {
      chartOutput = asciichart.plot(prices, {
        height: chartHeight,
        format: (x: number) => x.toFixed(0).padStart(3) + '¢',
        colors: [asciichart.green],
      });
    } catch {
      chartOutput = 'Unable to render chart';
    }
  }

  // Time labels
  const startTime = priceHistory.length > 0 ? formatTime(priceHistory[0].timestamp) : '';
  const endTime = priceHistory.length > 0 ? formatTime(priceHistory[priceHistory.length - 1].timestamp) : '';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="cyan"
      height={height}
      width="100%"
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color="cyan" bold> PRICE CHART</Text>
          <Text color="gray">: {ticker || 'Select a market'}</Text>
        </Box>
        {currentPrice !== null && priceChange !== null && (
          <Box>
            <Text color="white" bold>{currentPrice.toFixed(0)}¢</Text>
            <Text color={parseFloat(priceChange) >= 0 ? 'green' : 'red'}>
              {' '}({parseFloat(priceChange) >= 0 ? '+' : ''}{priceChange}%)
            </Text>
          </Box>
        )}
      </Box>

      {/* Stats bar */}
      {prices.length > 0 && (
        <Box paddingX={1}>
          <Text color="gray">
            Low: <Text color="red">{minPrice?.toFixed(0)}¢</Text>
            {' '} High: <Text color="green">{maxPrice?.toFixed(0)}¢</Text>
            {' '} Trades: <Text color="yellow">{priceHistory.length}</Text>
          </Text>
        </Box>
      )}

      {/* Chart */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {prices.length < 2 ? (
          <Box flexDirection="column" justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color="gray">
              {priceHistory.length === 0 
                ? 'No trade history available' 
                : 'Not enough data points for chart'}
            </Text>
            <Text color="gray" dimColor>
              Select a market with recent trades
            </Text>
          </Box>
        ) : (
          <Text>{chartOutput}</Text>
        )}
      </Box>

      {/* Time axis */}
      {prices.length >= 2 && (
        <Box paddingX={1} justifyContent="space-between">
          <Text color="gray">{startTime}</Text>
          <Text color="gray">─ 24h ─</Text>
          <Text color="gray">{endTime}</Text>
        </Box>
      )}

    </Box>
  );
}

