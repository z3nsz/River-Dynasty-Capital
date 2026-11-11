import { describe, it, expect } from "vitest";
import {
  dcfValue,
  ema,
  normCdf,
  gbmTerminalPdf,
  gbmMean,
  gbmPath,
  gbmProbBelowStart,
  mulberry32,
  impliedVol,
  lorenzTrajectory,
} from "@/lib/site/math";

const base = { fcf0: 1.8, growth: 0.09, terminalGrowth: 0.025, years: 5 };

describe("dcfValue", () => {
  it("matches a hand-computed two-stage DCF", () => {
    // g = r = 9% makes each explicit-year PV exactly fcf0, so PV(FCF) = 5 * 1.8.
    const fcf5 = 1.8 * 1.09 ** 5;
    const tv = (fcf5 * 1.025) / (0.09 - 0.025);
    const expected = 9 + tv / 1.09 ** 5;
    expect(dcfValue({ ...base, discount: 0.09 })).toBeCloseTo(expected, 6);
  });
  it("falls as the discount rate rises", () => {
    expect(dcfValue({ ...base, discount: 0.07 })).toBeGreaterThan(dcfValue({ ...base, discount: 0.12 }));
  });
  it("is undefined (infinite) when discount <= terminal growth", () => {
    expect(dcfValue({ ...base, discount: 0.02 })).toBe(Infinity);
  });
});

describe("ema", () => {
  it("converges to a constant input", () => {
    const out = ema(Array(200).fill(5), 12);
    expect(out[199]).toBeCloseTo(5, 9);
  });
  it("uses alpha = 2 / (n + 1)", () => {
    const out = ema([0, 10], 3); // alpha = 0.5
    expect(out[1]).toBeCloseTo(5, 9);
  });
});

describe("normal + GBM", () => {
  it("normCdf hits known points", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 4);
  });
  it("lognormal pdf integrates to ~1", () => {
    let area = 0;
    for (let x = 0.5; x < 400; x += 0.5) area += gbmTerminalPdf(x, 100, 0.08, 0.25, 1) * 0.5;
    expect(area).toBeCloseTo(1, 2);
  });
  it("simulated mean approaches E[S_T] = S0 e^{mu T}", () => {
    const rand = mulberry32(7);
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const p = gbmPath(100, 0.08, 0.2, 1, 50, rand);
      sum += p[p.length - 1];
    }
    expect(sum / n).toBeCloseTo(gbmMean(100, 0.08, 1), 0);
  });
  it("P(S_T < S0) uses the median drift mu - sigma^2/2", () => {
    // mu = sigma^2 / 2 puts the median exactly at S0.
    expect(gbmProbBelowStart(0.02, 0.2, 1)).toBeCloseTo(0.5, 6);
  });
});

describe("impliedVol", () => {
  it("has downside skew (OTM puts richer than OTM calls)", () => {
    expect(impliedVol(-0.2, 0.5, 0.3)).toBeGreaterThan(impliedVol(0.2, 0.5, 0.3));
  });
  it("skew flattens with maturity", () => {
    const short = impliedVol(-0.2, 0.1, 0.3) - impliedVol(0.2, 0.1, 0.3);
    const long = impliedVol(-0.2, 2, 0.3) - impliedVol(0.2, 2, 0.3);
    expect(short).toBeGreaterThan(long);
  });
});

describe("lorenzTrajectory", () => {
  it("stays on the bounded attractor", () => {
    const t = lorenzTrajectory(4000);
    for (let i = 0; i < t.length; i += 3) {
      expect(Math.abs(t[i])).toBeLessThan(25);
      expect(Math.abs(t[i + 1])).toBeLessThan(35);
      expect(t[i + 2]).toBeGreaterThan(0);
      expect(t[i + 2]).toBeLessThan(55);
    }
  });
});
