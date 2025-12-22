import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatCurrency,
  formatPercent,
  formatPriceChange,
  formatCompactNumber,
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

