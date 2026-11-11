/**
 * Real calculations behind the public site's visualizations. Pure functions,
 * no DOM — shared by the canvas charts and covered by unit tests.
 */

/** Deterministic PRNG (mulberry32) so illustrative data is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via Box–Muller. */
export function gaussian(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------- valuation */

export interface DcfInputs {
  /** Free cash flow per share today. */
  fcf0: number;
  /** Annual growth over the explicit forecast years. */
  growth: number;
  /** Discount rate (cost of capital). */
  discount: number;
  /** Perpetual growth after the forecast. */
  terminalGrowth: number;
  /** Explicit forecast years. */
  years: number;
}

/**
 * Two-stage discounted cash flow: explicit years of growing FCF, then a
 * Gordon-growth terminal value, all discounted to today.
 */
export function dcfValue({ fcf0, growth, discount, terminalGrowth, years }: DcfInputs): number {
  if (discount <= terminalGrowth) return Infinity;
  let pv = 0;
  let fcf = fcf0;
  for (let t = 1; t <= years; t++) {
    fcf *= 1 + growth;
    pv += fcf / Math.pow(1 + discount, t);
  }
  const terminal = (fcf * (1 + terminalGrowth)) / (discount - terminalGrowth);
  return pv + terminal / Math.pow(1 + discount, years);
}

/* ------------------------------------------------------------ technicals */

/** Smoothing constant for an N-period EMA. */
export function emaAlpha(period: number): number {
  return 2 / (period + 1);
}

/** One EMA update step. */
export function emaStep(prev: number, value: number, alpha: number): number {
  return prev + alpha * (value - prev);
}

/** Full EMA series, seeded with the first value. */
export function ema(values: number[], period: number): number[] {
  const a = emaAlpha(period);
  const out: number[] = [];
  let e = values[0] ?? 0;
  for (const v of values) {
    e = emaStep(e, v, a);
    out.push(e);
  }
  return out;
}

/* ------------------------------------------------------- probability / MC */

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Density of S_T under geometric Brownian motion (lognormal). */
export function gbmTerminalPdf(x: number, s0: number, mu: number, sigma: number, t: number): number {
  if (x <= 0) return 0;
  const m = Math.log(s0) + (mu - (sigma * sigma) / 2) * t;
  const s = sigma * Math.sqrt(t);
  const z = (Math.log(x) - m) / s;
  return Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI));
}

/** E[S_T] under GBM. */
export function gbmMean(s0: number, mu: number, t: number): number {
  return s0 * Math.exp(mu * t);
}

/** P(S_T < S_0) under GBM. */
export function gbmProbBelowStart(mu: number, sigma: number, t: number): number {
  return normCdf(-((mu - (sigma * sigma) / 2) * Math.sqrt(t)) / sigma);
}

/** One exact GBM path on an even time grid. */
export function gbmPath(
  s0: number,
  mu: number,
  sigma: number,
  t: number,
  steps: number,
  rand: () => number,
): Float32Array {
  const dt = t / steps;
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const vol = sigma * Math.sqrt(dt);
  const out = new Float32Array(steps + 1);
  out[0] = s0;
  let s = s0;
  for (let i = 1; i <= steps; i++) {
    s *= Math.exp(drift + vol * gaussian(rand));
    out[i] = s;
  }
  return out;
}

/* --------------------------------------------------------- vol surface */

/**
 * Illustrative implied-volatility surface: ATM term structure plus a skew
 * and smile that flatten with maturity (√T scaling, as in SVI-style fits).
 * `stress` ∈ [0,1] steepens skew and lifts short-dated vol.
 */
export function impliedVol(logMoneyness: number, maturity: number, stress: number): number {
  const t = Math.max(maturity, 0.02);
  const atm = 0.16 + 0.05 * stress + (0.06 * stress + 0.02) * Math.exp(-2.2 * t);
  const skew = -(0.12 + 0.1 * stress) / Math.sqrt(t + 0.08);
  const smile = (0.22 + 0.08 * stress) / Math.sqrt(t + 0.08);
  return Math.max(0.04, atm + skew * logMoneyness * 0.5 + smile * logMoneyness * logMoneyness);
}

/* --------------------------------------------------------------- Lorenz */

/** Lorenz system integrated with RK4; returns xyz triples. */
export function lorenzTrajectory(
  samples: number,
  dt = 0.006,
  sigma = 10,
  rho = 28,
  beta = 8 / 3,
  burnIn = 1500,
): Float32Array {
  let x = 0.1;
  let y = 0;
  let z = 0;
  const f = (px: number, py: number, pz: number): [number, number, number] => [
    sigma * (py - px),
    px * (rho - pz) - py,
    px * py - beta * pz,
  ];
  const out = new Float32Array(samples * 3);
  for (let i = -burnIn; i < samples; i++) {
    const k1 = f(x, y, z);
    const k2 = f(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2]);
    const k3 = f(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2]);
    const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (i >= 0) {
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = z;
    }
  }
  return out;
}
