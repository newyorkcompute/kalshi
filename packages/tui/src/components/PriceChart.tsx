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
 * Spread trade points evenly across the chart width
 * This fills the entire width regardless of time gaps
 */
function spreadPrices(trades: TradePoint[], targetPoints: number): number[] {
  if (trades.length === 0) return [];
  if (trades.length === 1) {
    // Single point - fill the width with the same value
    return Array(targetPoints).fill(trades[0].price);
  }

  // If we have fewer trades than target points, interpolate
  if (trades.length <= targetPoints) {
    const result: number[] = [];
    const step = (trades.length - 1) / (targetPoints - 1);
    
    for (let i = 0; i < targetPoints; i++) {
      const tradeIndex = i * step;
      const lowerIndex = Math.floor(tradeIndex);
      const upperIndex = Math.min(Math.ceil(tradeIndex), trades.length - 1);
      
      if (lowerIndex === upperIndex) {
        result.push(trades[lowerIndex].price);
      } else {
        // Linear interpolation between points
        const fraction = tradeIndex - lowerIndex;
        const interpolated = trades[lowerIndex].price + 
          (trades[upperIndex].price - trades[lowerIndex].price) * fraction;
        result.push(interpolated);
      }
    }
    return result;
  }

  // If we have more trades than target points, sample/aggregate
  const result: number[] = [];
  const step = trades.length / targetPoints;
  
  for (let i = 0; i < targetPoints; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);
    
    // Average the prices in this bucket
    let sum = 0;
    let count = 0;
    for (let j = startIdx; j < endIdx && j < trades.length; j++) {
      sum += trades[j].price;
      count++;
    }
    result.push(count > 0 ? sum / count : trades[startIdx].price);
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

  // Spread prices across the full chart width
  const prices = spreadPrices(priceHistory, chartWidth);

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

