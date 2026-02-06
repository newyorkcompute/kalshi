import { describe, it, expect } from "vitest";
import {
  getCategoryProfile,
  getCategoryWeight,
  shouldAvoidCategory,
} from "./category-weights.js";

describe("getCategoryProfile", () => {
  it("returns high weight for entertainment", () => {
    const profile = getCategoryProfile("entertainment");
    expect(profile.weight).toBeGreaterThanOrEqual(0.8);
    expect(profile.label).toBe("Entertainment");
  });

  it("returns high weight for media", () => {
    const profile = getCategoryProfile("media");
    expect(profile.weight).toBeGreaterThanOrEqual(0.9);
    expect(profile.label).toBe("Media");
  });

  it("returns moderate weight for sports", () => {
    const profile = getCategoryProfile("sports");
    expect(profile.weight).toBeGreaterThan(0.4);
    expect(profile.weight).toBeLessThan(0.7);
    expect(profile.label).toBe("Sports");
  });

  it("returns low weight for finance", () => {
    const profile = getCategoryProfile("finance");
    expect(profile.weight).toBeLessThan(0.1);
    expect(profile.label).toBe("Finance");
  });

  it("is case-insensitive", () => {
    const p1 = getCategoryProfile("SPORTS");
    const p2 = getCategoryProfile("sports");
    expect(p1.weight).toBe(p2.weight);
  });

  it("matches by ticker when category is empty", () => {
    const profile = getCategoryProfile("", "KXNFL-GAME-123");
    expect(profile.label).toBe("Sports");
  });

  it("matches by title when category and ticker miss", () => {
    const profile = getCategoryProfile("", "KXFOO", "Will bitcoin reach 100k?");
    expect(profile.label).toBe("Crypto");
  });

  it("returns default for unknown category", () => {
    const profile = getCategoryProfile("alien-invasion");
    expect(profile.weight).toBe(0.4);
    expect(profile.label).toBe("Unknown");
  });
});

describe("getCategoryWeight", () => {
  it("returns weight directly", () => {
    const weight = getCategoryWeight("sports");
    expect(weight).toBe(0.55);
  });
});

describe("shouldAvoidCategory", () => {
  it("avoids finance", () => {
    expect(shouldAvoidCategory("finance")).toBe(true);
  });

  it("avoids economics", () => {
    expect(shouldAvoidCategory("economics")).toBe(true);
  });

  it("avoids finance tickers", () => {
    expect(shouldAvoidCategory("", "KXFED-RATE-JAN")).toBe(true);
    expect(shouldAvoidCategory("", "KXCPI-25FEB")).toBe(true);
  });

  it("does not avoid sports", () => {
    expect(shouldAvoidCategory("sports")).toBe(false);
  });

  it("does not avoid entertainment", () => {
    expect(shouldAvoidCategory("entertainment")).toBe(false);
  });
});
