import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatExpiry,
  getPriceChange,
  formatVolume,
  formatPrice,
  formatPriceDecimal,
  calculateSpread,
  calculateArbitrage,
  type ArbitrageMarket,
} from './utils.js';

describe('formatExpiry', () => {
  beforeEach(() => {
    // Mock current time to 2025-01-01 12:00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for undefined', () => {
    expect(formatExpiry(undefined)).toBe('');
  });

  it('returns CLOSED for past dates', () => {
    expect(formatExpiry('2025-01-01T11:00:00Z')).toBe('CLOSED');
    expect(formatExpiry('2024-12-31T00:00:00Z')).toBe('CLOSED');
  });

  it('formats days and hours for dates <= 30 days away', () => {
    expect(formatExpiry('2025-01-03T12:00:00Z')).toBe('2d 0h');
    expect(formatExpiry('2025-01-04T02:00:00Z')).toBe('2d 14h');
    expect(formatExpiry('2025-01-20T12:00:00Z')).toBe('19d 0h');
  });

  it('formats just days for dates > 30 days away', () => {
    expect(formatExpiry('2025-03-01T12:00:00Z')).toBe('59d');
    expect(formatExpiry('2025-06-01T12:00:00Z')).toBe('151d');
  });

  it('formats years and months for dates >= 1 year away', () => {
    expect(formatExpiry('2026-01-01T12:00:00Z')).toBe('1y');
    expect(formatExpiry('2026-07-01T12:00:00Z')).toBe('1y 6mo');
    expect(formatExpiry('2028-01-01T12:00:00Z')).toBe('3y');
  });

  it('returns "distant" for dates > 10 years away', () => {
    expect(formatExpiry('2040-01-01T12:00:00Z')).toBe('distant');
    expect(formatExpiry('2100-01-01T12:00:00Z')).toBe('distant');
  });

  it('formats hours and minutes for dates < 24h away', () => {
    expect(formatExpiry('2025-01-01T15:30:00Z')).toBe('3h 30m');
    expect(formatExpiry('2025-01-01T14:00:00Z')).toBe('2h 0m');
  });

  it('formats minutes only for dates < 1h away', () => {
    expect(formatExpiry('2025-01-01T12:45:00Z')).toBe('45m');
    expect(formatExpiry('2025-01-01T12:05:00Z')).toBe('5m');
  });
});

describe('getPriceChange', () => {
  it('returns gray dash for undefined values', () => {
    expect(getPriceChange(undefined, undefined)).toEqual({ text: '━', color: 'gray' });
    expect(getPriceChange(50, undefined)).toEqual({ text: '━', color: 'gray' });
    expect(getPriceChange(undefined, 50)).toEqual({ text: '━', color: 'gray' });
  });

  it('returns gray dash for equal values', () => {
    expect(getPriceChange(50, 50)).toEqual({ text: '━', color: 'gray' });
    expect(getPriceChange(0, 0)).toEqual({ text: '━', color: 'gray' });
  });

  it('returns green up arrow for price increase', () => {
    expect(getPriceChange(55, 50)).toEqual({ text: '▲', color: 'green' });
    expect(getPriceChange(100, 1)).toEqual({ text: '▲', color: 'green' });
  });

  it('returns red down arrow for price decrease', () => {
    expect(getPriceChange(45, 50)).toEqual({ text: '▼', color: 'red' });
    expect(getPriceChange(1, 100)).toEqual({ text: '▼', color: 'red' });
  });
});

describe('formatVolume', () => {
  it('returns empty string for undefined/zero', () => {
    expect(formatVolume(undefined)).toBe('');
    expect(formatVolume(0)).toBe('');
  });

  it('formats millions with M suffix', () => {
    expect(formatVolume(1500000)).toBe('1.5M');
    expect(formatVolume(10000000)).toBe('10.0M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatVolume(1500)).toBe('1.5K');
    expect(formatVolume(50000)).toBe('50.0K');
  });

  it('leaves small numbers as-is', () => {
    expect(formatVolume(500)).toBe('500');
    expect(formatVolume(42)).toBe('42');
  });
});

describe('formatPrice', () => {
  it('formats cents with cent symbol', () => {
    expect(formatPrice(45)).toBe('45¢');
    expect(formatPrice(99)).toBe('99¢');
    expect(formatPrice(0)).toBe('0¢');
  });

  it('returns dash for undefined', () => {
    expect(formatPrice(undefined)).toBe('—');
  });
});

describe('formatPriceDecimal', () => {
  it('formats price with two decimal places', () => {
    expect(formatPriceDecimal(45)).toBe('45.00¢');
    expect(formatPriceDecimal(99.5)).toBe('99.50¢');
    expect(formatPriceDecimal(0.01)).toBe('0.01¢');
  });
});

describe('calculateSpread', () => {
  it('returns null if either value is null', () => {
    expect(calculateSpread(null, null)).toBeNull();
    expect(calculateSpread(50, null)).toBeNull();
    expect(calculateSpread(null, 55)).toBeNull();
  });

  it('calculates spread correctly', () => {
    expect(calculateSpread(50, 55)).toBe(5);
    expect(calculateSpread(45, 47)).toBe(2);
    expect(calculateSpread(99, 100)).toBe(1);
  });

  it('handles zero spread', () => {
    expect(calculateSpread(50, 50)).toBe(0);
  });
});

describe('calculateArbitrage', () => {
  describe('single-market arbitrage', () => {
    it('detects when YES + NO < 100', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'MARKET1', yes_ask: 47, no_ask: 51 }, // Total 98, profit 2
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(1);
      expect(result.singleMarket[0]).toEqual({
        ticker: 'MARKET1',
        yesAsk: 47,
        noAsk: 51,
        total: 98,
        profit: 2,
      });
    });

    it('ignores markets where YES + NO >= 100', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'MARKET1', yes_ask: 50, no_ask: 50 }, // Total 100, no arb
        { ticker: 'MARKET2', yes_ask: 60, no_ask: 45 }, // Total 105, no arb
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(0);
    });

    it('ignores markets with missing prices', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'MARKET1', yes_ask: 47 }, // no no_ask
        { ticker: 'MARKET2', no_ask: 51 },  // no yes_ask
        { ticker: 'MARKET3' },               // no prices
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(0);
    });

    it('sorts by profit descending', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'SMALL', yes_ask: 49, no_ask: 50 },   // profit 1
        { ticker: 'LARGE', yes_ask: 40, no_ask: 50 },   // profit 10
        { ticker: 'MEDIUM', yes_ask: 45, no_ask: 50 },  // profit 5
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(3);
      expect(result.singleMarket[0].ticker).toBe('LARGE');
      expect(result.singleMarket[1].ticker).toBe('MEDIUM');
      expect(result.singleMarket[2].ticker).toBe('SMALL');
    });
  });

  describe('event arbitrage', () => {
    it('detects when sum of YES prices in event < 100', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'EVENT-A', yes_ask: 30, no_ask: 80, event_ticker: 'EVENT' },
        { ticker: 'EVENT-B', yes_ask: 30, no_ask: 80, event_ticker: 'EVENT' },
        { ticker: 'EVENT-C', yes_ask: 30, no_ask: 80, event_ticker: 'EVENT' },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        eventTicker: 'EVENT',
        total: 90, // 30 + 30 + 30
        profit: 10,
      });
      expect(result.events[0].markets).toHaveLength(3);
    });

    it('ignores events where sum >= 100', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'EVENT-A', yes_ask: 50, no_ask: 60, event_ticker: 'EVENT' },
        { ticker: 'EVENT-B', yes_ask: 50, no_ask: 60, event_ticker: 'EVENT' },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.events).toHaveLength(0);
    });

    it('requires at least 2 markets per event', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'EVENT-A', yes_ask: 30, no_ask: 80, event_ticker: 'EVENT' },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.events).toHaveLength(0);
    });

    it('groups markets by event_ticker', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'EVENT1-A', yes_ask: 30, event_ticker: 'EVENT1' },
        { ticker: 'EVENT1-B', yes_ask: 30, event_ticker: 'EVENT1' },
        { ticker: 'EVENT2-A', yes_ask: 20, event_ticker: 'EVENT2' },
        { ticker: 'EVENT2-B', yes_ask: 20, event_ticker: 'EVENT2' },
        { ticker: 'EVENT2-C', yes_ask: 20, event_ticker: 'EVENT2' },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.events).toHaveLength(2);
      // EVENT2 should be first (40% profit vs 40% profit, but more markets)
      const event1 = result.events.find(e => e.eventTicker === 'EVENT1');
      const event2 = result.events.find(e => e.eventTicker === 'EVENT2');
      
      expect(event1?.markets).toHaveLength(2);
      expect(event1?.total).toBe(60);
      expect(event2?.markets).toHaveLength(3);
      expect(event2?.total).toBe(60);
    });

    it('sorts events by profit descending', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'SMALL-A', yes_ask: 45, event_ticker: 'SMALL' },
        { ticker: 'SMALL-B', yes_ask: 45, event_ticker: 'SMALL' }, // 90 total, 10 profit
        { ticker: 'LARGE-A', yes_ask: 20, event_ticker: 'LARGE' },
        { ticker: 'LARGE-B', yes_ask: 20, event_ticker: 'LARGE' }, // 40 total, 60 profit
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.events[0].eventTicker).toBe('LARGE');
      expect(result.events[1].eventTicker).toBe('SMALL');
    });
  });

  describe('combined scenarios', () => {
    it('returns both single-market and event arbitrage', () => {
      const markets: ArbitrageMarket[] = [
        // Single-market arb
        { ticker: 'SINGLE', yes_ask: 47, no_ask: 51 },
        // Event arb
        { ticker: 'EVENT-A', yes_ask: 30, event_ticker: 'EVENT' },
        { ticker: 'EVENT-B', yes_ask: 30, event_ticker: 'EVENT' },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(1);
      expect(result.events).toHaveLength(1);
    });

    it('returns empty arrays when no opportunities exist', () => {
      const markets: ArbitrageMarket[] = [
        { ticker: 'MARKET1', yes_ask: 50, no_ask: 55 },
        { ticker: 'MARKET2', yes_ask: 60, no_ask: 45 },
      ];
      const result = calculateArbitrage(markets);
      
      expect(result.singleMarket).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    });

    it('handles empty markets array', () => {
      const result = calculateArbitrage([]);
      
      expect(result.singleMarket).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    });
  });
});

