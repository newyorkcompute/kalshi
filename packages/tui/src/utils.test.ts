import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatExpiry,
  getPriceChange,
  formatVolume,
  formatPrice,
  formatPriceDecimal,
  calculateSpread,
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

