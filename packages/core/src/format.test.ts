import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatPrice,
  formatCurrency,
  formatPercent,
  formatPriceChange,
  formatCompactNumber,
  formatRelativeTime,
  formatExpiry,
  calculateSpread,
  truncate,
  padString,
} from "./format.js";

describe("formatPrice", () => {
  it("formats cents with cent symbol", () => {
    expect(formatPrice(45)).toBe("45¢");
    expect(formatPrice(99)).toBe("99¢");
    expect(formatPrice(1)).toBe("1¢");
  });

  it("returns dash for null/undefined", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("formats cents as dollars", () => {
    expect(formatCurrency(4500)).toBe("$45.00");
    expect(formatCurrency(100)).toBe("$1.00");
    expect(formatCurrency(50)).toBe("$0.50");
  });

  it("returns dash for null/undefined", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(0.45)).toBe("45%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.05)).toBe("5%");
  });

  it("returns dash for null/undefined", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });
});

describe("formatPriceChange", () => {
  it("shows up arrow for positive change", () => {
    expect(formatPriceChange(2)).toBe("▲ +2");
    expect(formatPriceChange(10)).toBe("▲ +10");
  });

  it("shows down arrow for negative change", () => {
    expect(formatPriceChange(-3)).toBe("▼ -3");
    expect(formatPriceChange(-15)).toBe("▼ -15");
  });

  it("shows horizontal line for no change", () => {
    expect(formatPriceChange(0)).toBe("━ 0");
  });
});

describe("formatCompactNumber", () => {
  it("formats millions with M suffix", () => {
    expect(formatCompactNumber(1_500_000)).toBe("1.5M");
    expect(formatCompactNumber(10_000_000)).toBe("10.0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompactNumber(1_500)).toBe("1.5K");
    expect(formatCompactNumber(50_000)).toBe("50.0K");
  });

  it("leaves small numbers as-is", () => {
    expect(formatCompactNumber(500)).toBe("500");
    expect(formatCompactNumber(42)).toBe("42");
  });

  it("returns dash for null/undefined", () => {
    expect(formatCompactNumber(null)).toBe("—");
    expect(formatCompactNumber(undefined)).toBe("—");
  });
});

describe("truncate", () => {
  it("truncates long strings with ellipsis", () => {
    expect(truncate("Hello World", 8)).toBe("Hello W…");
    expect(truncate("Very Long String", 10)).toBe("Very Long…");
  });

  it("returns short strings unchanged", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
    expect(truncate("Hi", 5)).toBe("Hi");
  });
});

describe("padString", () => {
  it("pads strings to the right by default", () => {
    expect(padString("Hi", 5)).toBe("Hi   ");
    expect(padString("Test", 8)).toBe("Test    ");
  });

  it("pads strings to the left when specified", () => {
    expect(padString("Hi", 5, "right")).toBe("   Hi");
    expect(padString("42", 5, "right")).toBe("   42");
  });

  it("truncates strings that are too long", () => {
    expect(padString("Hello World", 5)).toBe("Hello");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'now' for current time", () => {
    expect(formatRelativeTime('2025-06-15T12:00:00Z')).toBe('now');
    expect(formatRelativeTime(new Date('2025-06-15T12:00:30Z'))).toBe('now');
  });

  it("formats past minutes", () => {
    expect(formatRelativeTime('2025-06-15T11:30:00Z')).toBe('30m ago');
    expect(formatRelativeTime('2025-06-15T11:45:00Z')).toBe('15m ago');
  });

  it("formats past hours", () => {
    expect(formatRelativeTime('2025-06-15T09:00:00Z')).toBe('3h ago');
    expect(formatRelativeTime('2025-06-15T06:00:00Z')).toBe('6h ago');
  });

  it("formats past days", () => {
    expect(formatRelativeTime('2025-06-13T12:00:00Z')).toBe('2d ago');
    expect(formatRelativeTime('2025-06-10T12:00:00Z')).toBe('5d ago');
  });

  it("formats future minutes", () => {
    expect(formatRelativeTime('2025-06-15T12:30:00Z')).toBe('in 30m');
    expect(formatRelativeTime('2025-06-15T12:15:00Z')).toBe('in 15m');
  });

  it("formats future hours", () => {
    expect(formatRelativeTime('2025-06-15T15:00:00Z')).toBe('in 3h');
    expect(formatRelativeTime('2025-06-15T18:00:00Z')).toBe('in 6h');
  });

  it("formats future days", () => {
    expect(formatRelativeTime('2025-06-17T12:00:00Z')).toBe('in 2d');
    expect(formatRelativeTime('2025-06-20T12:00:00Z')).toBe('in 5d');
  });

  it("accepts Date objects", () => {
    expect(formatRelativeTime(new Date('2025-06-15T11:00:00Z'))).toBe('1h ago');
    expect(formatRelativeTime(new Date('2025-06-16T12:00:00Z'))).toBe('in 1d');
  });
});

describe("formatExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for undefined", () => {
    expect(formatExpiry(undefined)).toBe('');
  });

  it("returns CLOSED for past dates", () => {
    expect(formatExpiry('2025-06-14T12:00:00Z')).toBe('CLOSED');
    expect(formatExpiry('2020-01-01T00:00:00Z')).toBe('CLOSED');
  });

  it("formats minutes", () => {
    expect(formatExpiry('2025-06-15T12:30:00Z')).toBe('30m');
    expect(formatExpiry('2025-06-15T12:45:00Z')).toBe('45m');
  });

  it("formats hours and minutes", () => {
    expect(formatExpiry('2025-06-15T15:30:00Z')).toBe('3h 30m');
    expect(formatExpiry('2025-06-15T20:00:00Z')).toBe('8h 0m');
  });

  it("formats days and hours", () => {
    expect(formatExpiry('2025-06-17T12:00:00Z')).toBe('2d 0h');
    expect(formatExpiry('2025-06-20T18:00:00Z')).toBe('5d 6h');
  });

  it("formats just days for >30 days", () => {
    expect(formatExpiry('2025-08-15T12:00:00Z')).toBe('61d');
    expect(formatExpiry('2025-10-15T12:00:00Z')).toBe('122d');
  });

  it("formats years and months", () => {
    expect(formatExpiry('2026-06-15T12:00:00Z')).toBe('1y');
    expect(formatExpiry('2027-09-15T12:00:00Z')).toBe('2y 3mo');
  });

  it("returns distant for >10 years", () => {
    expect(formatExpiry('2036-06-15T12:00:00Z')).toBe('distant');
    expect(formatExpiry('2099-01-01T00:00:00Z')).toBe('distant');
  });
});

describe("calculateSpread", () => {
  it("calculates spread correctly", () => {
    expect(calculateSpread(48, 52)).toBe(4);
    expect(calculateSpread(45, 55)).toBe(10);
    expect(calculateSpread(50, 51)).toBe(1);
  });

  it("returns null for null bid", () => {
    expect(calculateSpread(null, 52)).toBeNull();
  });

  it("returns null for null ask", () => {
    expect(calculateSpread(48, null)).toBeNull();
  });

  it("returns null for undefined values", () => {
    expect(calculateSpread(undefined, 52)).toBeNull();
    expect(calculateSpread(48, undefined)).toBeNull();
    expect(calculateSpread(undefined, undefined)).toBeNull();
  });

  it("handles zero spread", () => {
    expect(calculateSpread(50, 50)).toBe(0);
  });

  it("handles negative spread (crossed market)", () => {
    expect(calculateSpread(52, 48)).toBe(-4);
  });
});

