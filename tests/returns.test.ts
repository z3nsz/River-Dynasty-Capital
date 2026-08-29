import { describe, it, expect } from "vitest";
import {
  holdingReturn,
  sleeveReturn,
  cagr,
  benchmarkReturn,
  excessPoints,
  toIndex,
} from "@/lib/returns";

describe("holdingReturn", () => {
  it("computes (current - entry) / entry", () => {
    expect(holdingReturn(48, 172.8)).toBeCloseTo(2.6, 5);
    expect(holdingReturn(125, 90)).toBeCloseTo(-0.28, 5);
  });
  it("returns null on missing or invalid data", () => {
    expect(holdingReturn(48, null)).toBeNull();
    expect(holdingReturn(0, 10)).toBeNull();
  });
});

describe("sleeveReturn", () => {
  it("is the weight-weighted average, normalised by total weight", () => {
    const r = sleeveReturn([
      { weight: 50, ret: 0.2 },
      { weight: 50, ret: 0.4 },
    ]);
    expect(r).toBeCloseTo(0.3, 6);
  });
  it("ignores holdings with no return and renormalises", () => {
    const r = sleeveReturn([
      { weight: 40, ret: 0.5 },
      { weight: 60, ret: null },
    ]);
    expect(r).toBeCloseTo(0.5, 6);
  });
  it("matches the Seine seed sleeve", () => {
    const r = sleeveReturn([
      { weight: 22, ret: holdingReturn(48, 172.8)! },
      { weight: 20, ret: holdingReturn(500, 900)! },
      { weight: 18, ret: holdingReturn(300, 465)! },
      { weight: 16, ret: holdingReturn(220, 319)! },
      { weight: 14, ret: holdingReturn(620, 1023)! },
      { weight: 10, ret: holdingReturn(125, 90)! },
    ]);
    expect(r).toBeGreaterThan(0.9);
    expect(r).toBeLessThan(1.05);
  });
  it("returns null when nothing has a price", () => {
    expect(sleeveReturn([{ weight: 10, ret: null }])).toBeNull();
  });
});

describe("cagr", () => {
  it("annualises a multi-year total return", () => {
    // doubling over ~2 years -> ~41.4%
    expect(cagr(1, 730.5)).toBeCloseTo(0.4142, 3);
  });
  it("guards against sub-day windows", () => {
    expect(cagr(0.1, 0)).toBeNull();
  });
});

describe("benchmark + excess", () => {
  it("benchmarkReturn = current / inception - 1", () => {
    expect(benchmarkReturn(380.82, 620)).toBeCloseTo(0.628, 3);
  });
  it("excessPoints is in percentage points", () => {
    expect(excessPoints(0.966, 0.628)).toBeCloseTo(33.8, 1);
  });
  it("propagates nulls", () => {
    expect(benchmarkReturn(380.82, null)).toBeNull();
    expect(excessPoints(null, 0.1)).toBeNull();
  });
});

describe("toIndex", () => {
  it("maps a return ratio onto a 100 base", () => {
    expect(toIndex(0)).toBe(100);
    expect(toIndex(0.966)).toBeCloseTo(196.6, 4);
  });
});
