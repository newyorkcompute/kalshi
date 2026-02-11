import { describe, it, expect } from "vitest";
import { parseWeatherTicker, isWeatherTicker } from "./ticker-parser.js";

describe("isWeatherTicker", () => {
  it("returns true for high temp tickers", () => {
    expect(isWeatherTicker("KXHIGHAUS-26FEB12-T85")).toBe(true);
    expect(isWeatherTicker("KXHIGHNY-26FEB11-T43")).toBe(true);
    expect(isWeatherTicker("KXHIGHTLV-26FEB11-T64")).toBe(true);
  });

  it("returns true for low temp tickers", () => {
    expect(isWeatherTicker("KXLOWTCHI-26FEB11-B23.5")).toBe(true);
    expect(isWeatherTicker("KXLOWTMIA-26FEB11-B55.5")).toBe(true);
  });

  it("returns false for non-weather tickers", () => {
    expect(isWeatherTicker("KXNBA2D-26FEB11PORMIN-MINAEDWARDS5")).toBe(false);
    expect(isWeatherTicker("KXBTC-25JAN03-B100500")).toBe(false);
    expect(isWeatherTicker("KXELONMARS-99")).toBe(false);
  });
});

describe("parseWeatherTicker", () => {
  describe("high temperature tickers", () => {
    it("parses above-threshold ticker (KXHIGHAUS-26FEB12-T85)", () => {
      const result = parseWeatherTicker("KXHIGHAUS-26FEB12-T85");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("AUS");
      expect(result!.date).toBe("2026-02-12");
      expect(result!.strike).toBe(85);
      expect(result!.direction).toBe("above");
    });

    it("parses below-threshold ticker with strikeType hint", () => {
      const result = parseWeatherTicker("KXHIGHAUS-26FEB12-T78", "less");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("AUS");
      expect(result!.date).toBe("2026-02-12");
      expect(result!.strike).toBe(78);
      expect(result!.direction).toBe("below");
    });

    it("parses range bucket ticker (KXHIGHAUS-26FEB12-B82.5)", () => {
      const result = parseWeatherTicker("KXHIGHAUS-26FEB12-B82.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("AUS");
      expect(result!.date).toBe("2026-02-12");
      expect(result!.strike).toBe(82.5);
      expect(result!.direction).toBe("range");
      expect(result!.rangeLow).toBe(81.5);
      expect(result!.rangeHigh).toBe(83.5);
    });

    it("parses NYC ticker (KXHIGHNY-26FEB11-T43)", () => {
      const result = parseWeatherTicker("KXHIGHNY-26FEB11-T43");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("NY");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(43);
      expect(result!.direction).toBe("above");
    });

    it("parses Las Vegas ticker with T-prefix city (KXHIGHTLV-26FEB11-T64)", () => {
      const result = parseWeatherTicker("KXHIGHTLV-26FEB11-T64");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("LV");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(64);
      expect(result!.direction).toBe("above");
    });

    it("parses Chicago high ticker (KXHIGHCHI-26FEB11-T43)", () => {
      const result = parseWeatherTicker("KXHIGHCHI-26FEB11-T43");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("CHI");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(43);
    });

    it("parses Atlanta high ticker (KXHIGHTATL-26FEB11-T62)", () => {
      const result = parseWeatherTicker("KXHIGHTATL-26FEB11-T62");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("ATL");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(62);
    });

    it("parses SFO high ticker (KXHIGHTSFO-26FEB11-T61)", () => {
      const result = parseWeatherTicker("KXHIGHTSFO-26FEB11-T61");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("SFO");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(61);
    });

    it("parses Seattle high ticker (KXHIGHTSEA-26FEB11-B47.5)", () => {
      const result = parseWeatherTicker("KXHIGHTSEA-26FEB11-B47.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("high");
      expect(result!.cityCode).toBe("SEA");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(47.5);
      expect(result!.direction).toBe("range");
      expect(result!.rangeLow).toBe(46.5);
      expect(result!.rangeHigh).toBe(48.5);
    });
  });

  describe("low temperature tickers", () => {
    it("parses Chicago low range ticker (KXLOWTCHI-26FEB11-B23.5)", () => {
      const result = parseWeatherTicker("KXLOWTCHI-26FEB11-B23.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("low");
      expect(result!.cityCode).toBe("CHI");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(23.5);
      expect(result!.direction).toBe("range");
      expect(result!.rangeLow).toBe(22.5);
      expect(result!.rangeHigh).toBe(24.5);
    });

    it("parses Miami low ticker (KXLOWTMIA-26FEB11-B55.5)", () => {
      const result = parseWeatherTicker("KXLOWTMIA-26FEB11-B55.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("low");
      expect(result!.cityCode).toBe("MIA");
      expect(result!.date).toBe("2026-02-11");
      expect(result!.strike).toBe(55.5);
      expect(result!.direction).toBe("range");
    });

    it("parses Austin low ticker (KXLOWTAUS-26FEB11-B57.5)", () => {
      const result = parseWeatherTicker("KXLOWTAUS-26FEB11-B57.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("low");
      expect(result!.cityCode).toBe("AUS");
      expect(result!.date).toBe("2026-02-11");
    });

    it("parses Philadelphia low ticker (KXLOWTPHIL-26FEB11-B29.5)", () => {
      const result = parseWeatherTicker("KXLOWTPHIL-26FEB11-B29.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("low");
      expect(result!.cityCode).toBe("PHIL");
      expect(result!.date).toBe("2026-02-11");
    });

    it("parses LAX low ticker (KXLOWTLAX-26FEB11-B51.5)", () => {
      const result = parseWeatherTicker("KXLOWTLAX-26FEB11-B51.5");
      expect(result).not.toBeNull();
      expect(result!.tempType).toBe("low");
      expect(result!.cityCode).toBe("LAX");
      expect(result!.date).toBe("2026-02-11");
    });
  });

  describe("edge cases", () => {
    it("returns null for non-KX tickers", () => {
      expect(parseWeatherTicker("BTCUSD-25JAN03")).toBeNull();
    });

    it("returns null for non-weather KX tickers", () => {
      expect(parseWeatherTicker("KXNBA2D-26FEB11PORMIN-MINAEDWARDS5")).toBeNull();
    });

    it("returns null for malformed tickers", () => {
      expect(parseWeatherTicker("KXHIGH-26FEB12-T85")).toBeNull(); // No city
      expect(parseWeatherTicker("KXHIGHAUS-26FEB12")).toBeNull(); // No strike
      expect(parseWeatherTicker("KXHIGHAUS")).toBeNull(); // No date or strike
    });

    it("returns null for unknown city codes", () => {
      expect(parseWeatherTicker("KXHIGHZZZ-26FEB12-T85")).toBeNull();
    });

    it("handles different months", () => {
      const jan = parseWeatherTicker("KXHIGHAUS-26JAN15-T85");
      expect(jan).not.toBeNull();
      expect(jan!.date).toBe("2026-01-15");

      const dec = parseWeatherTicker("KXHIGHAUS-26DEC25-T85");
      expect(dec).not.toBeNull();
      expect(dec!.date).toBe("2026-12-25");
    });
  });
});
