"use client";

import { useRef } from "react";
import { useCanvasLoop, C } from "./useCanvasLoop";
import { emaAlpha, emaStep, gaussian, mulberry32 } from "@/lib/site/math";

/**
 * Technical Analysis — a live market.
 *
 * A regime-switching price process streams in continuously. Between bars the
 * chart slides by a fraction of a bar every frame and the newest segment grows
 * toward the next value, so motion is fluid rather than stepped. EMA(12),
 * EMA(26) and the MACD histogram are updated incrementally. Market structure
 * is drawn as the last confirmed swing high/low; a level is retired once
 * price closes through it.
 */

const N = 190;
const BAR = 0.11; // seconds per bar
const SWING = 6; // bars each side to confirm a swing point
const aFast = emaAlpha(12);
const aSlow = emaAlpha(26);
const aSig = emaAlpha(9);

interface Bar {
  p: number;
  fast: number;
  slow: number;
  hist: number;
}

export function TechnicalChart() {
  const st = useRef<{
    rand: () => number;
    bars: Bar[];
    next: number;
    drift: number;
    noise: number;
    sig: number;
    acc: number;
    swingHi: number | null;
    swingLo: number | null;
    lo: number;
    hi: number;
    mHi: number;
  } | null>(null);

  const advance = () => {
    const s = st.current!;
    // regime switch: up-trend, drift, down-trend
    if (s.rand() < 0.018) {
      const u = s.rand();
      s.drift = u < 0.45 ? 0.085 : u < 0.75 ? 0.0 : -0.075;
    }
    s.noise = 0.62 * s.noise + gaussian(s.rand) * 0.26;
    const last = s.bars[s.bars.length - 1];
    const p = s.next;
    const fast = emaStep(last.fast, p, aFast);
    const slow = emaStep(last.slow, p, aSlow);
    const macd = fast - slow;
    s.sig = emaStep(s.sig, macd, aSig);
    s.bars.push({ p, fast, slow, hist: macd - s.sig });
    s.bars.shift();

    // confirm a swing at bars[len-1-SWING]
    const c = s.bars.length - 1 - SWING;
    const pc = s.bars[c].p;
    let isHi = true;
    let isLo = true;
    for (let i = c - SWING; i <= c + SWING; i++) {
      if (i === c) continue;
      if (s.bars[i].p >= pc) isHi = false;
      if (s.bars[i].p <= pc) isLo = false;
    }
    if (isHi) s.swingHi = pc;
    if (isLo) s.swingLo = pc;

    // retire a structure level once price closes through it
    if (s.swingHi !== null && p > s.swingHi) s.swingHi = null;
    if (s.swingLo !== null && p < s.swingLo) s.swingLo = null;

    s.next = p + s.drift + s.noise + 0.004 * (100 - p);
  };

  const { canvasRef } = useCanvasLoop(({ ctx, w, h, dt, reduce, mono }) => {
    if (!st.current) {
      const rand = mulberry32(2026);
      const seed: Bar = { p: 100, fast: 100, slow: 100, hist: 0 };
      st.current = {
        rand,
        bars: Array.from({ length: N }, () => ({ ...seed })),
        next: 100,
        drift: 0.06,
        noise: 0,
        sig: 0,
        acc: 0,
        swingHi: null,
        swingLo: null,
        lo: 95,
        hi: 105,
        mHi: 0.5,
      };
      for (let i = 0; i < N * 2; i++) advance(); // warm up a full window of history
    }
    const s = st.current;

    if (!reduce) {
      s.acc += dt;
      while (s.acc >= BAR) {
        s.acc -= BAR;
        advance();
      }
    }
    const phase = reduce ? 0 : s.acc / BAR;
    const lastBar = s.bars[N - 1];
    const tipP = lastBar.p + (s.next - lastBar.p) * phase;

    // panes
    const padT = 24;
    const priceB = h * 0.72;
    const momT = priceB + 14;
    const momB = h - 6;
    const plotR = w - 44;
    const dx = plotR / (N - 1);
    const x = (i: number) => (i - phase) * dx;

    // smooth autoscale
    let lo = Infinity;
    let hi = -Infinity;
    let mHi = 0.05;
    for (const b of s.bars) {
      lo = Math.min(lo, b.p, b.slow);
      hi = Math.max(hi, b.p, b.slow);
      mHi = Math.max(mHi, Math.abs(b.hist));
    }
    const pad = (hi - lo) * 0.14 + 0.2;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 2.4);
    s.lo += (lo - pad - s.lo) * k;
    s.hi += (hi + pad - s.hi) * k;
    s.mHi += (mHi - s.mHi) * k;
    const y = (p: number) => padT + (1 - (p - s.lo) / (s.hi - s.lo)) * (priceB - padT);
    const momMid = (momT + momB) / 2;
    const ym = (v: number) => momMid - (v / s.mHi) * ((momB - momT) / 2);

    ctx.clearRect(0, 0, w, h);

    // grid + price labels
    ctx.font = `10px ${mono}`;
    ctx.textBaseline = "middle";
    for (let g = 0; g <= 3; g++) {
      const gy = padT + ((priceB - padT) * g) / 3;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(plotR, gy);
      ctx.stroke();
      const val = s.hi - ((s.hi - s.lo) * g) / 3;
      ctx.fillStyle = C.faint;
      ctx.fillText(val.toFixed(1), plotR + 8, gy);
    }
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(0, momMid);
    ctx.lineTo(plotR, momMid);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotR, h);
    ctx.clip();

    // structure: last swing high / low levels
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    if (s.swingHi !== null) {
      ctx.strokeStyle = C.faint;
      ctx.beginPath();
      ctx.moveTo(0, y(s.swingHi));
      ctx.lineTo(plotR, y(s.swingHi));
      ctx.stroke();
    }
    if (s.swingLo !== null) {
      ctx.strokeStyle = C.faint;
      ctx.beginPath();
      ctx.moveTo(0, y(s.swingLo));
      ctx.lineTo(plotR, y(s.swingLo));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // area under price
    const grad = ctx.createLinearGradient(0, padT, 0, priceB);
    grad.addColorStop(0, "rgba(232,237,235,0.07)");
    grad.addColorStop(1, "rgba(232,237,235,0)");
    ctx.beginPath();
    ctx.moveTo(x(0), priceB);
    for (let i = 0; i < N; i++) ctx.lineTo(x(i), y(s.bars[i].p));
    ctx.lineTo(x(N - 1) + dx * phase, y(tipP));
    ctx.lineTo(x(N - 1) + dx * phase, priceB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const line = (get: (b: Bar) => number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const px = x(i);
        const py = y(get(s.bars[i]));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    line((b) => b.slow, C.blue, 1.25);
    line((b) => b.fast, C.teal, 1.25);
    line((b) => b.p, C.ink, 1.5);
    // live segment
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x(N - 1), y(lastBar.p));
    ctx.lineTo(x(N - 1) + dx * phase, y(tipP));
    ctx.stroke();

    // momentum histogram (MACD − signal)
    for (let i = 0; i < N; i++) {
      const v = s.bars[i].hist;
      ctx.fillStyle = v >= 0 ? "rgba(47,191,173,0.55)" : "rgba(201,128,111,0.5)";
      const top = Math.min(ym(v), momMid);
      ctx.fillRect(x(i) - dx * 0.35, top, Math.max(1, dx * 0.7), Math.abs(ym(v) - momMid));
    }
    ctx.restore();

    // tip dot + price tag
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x(N - 1) + dx * phase, y(tipP), 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `10px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.fillText(tipP.toFixed(2), plotR + 8, y(tipP));

    // legend
    ctx.textBaseline = "alphabetic";
    ctx.font = `11px ${mono}`;
    let lx = 0;
    for (const [label, color] of [
      ["Price", C.ink],
      ["EMA 12", C.teal],
      ["EMA 26", C.blue],
      ["MACD", C.muted],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, 9, 10, 2);
      ctx.fillStyle = C.muted;
      ctx.fillText(label, lx + 15, 14);
      lx += ctx.measureText(label).width + 34;
    }
  });

  return (
    <div className="rdc-viz">
      <canvas
        ref={canvasRef}
        className="rdc-viz-canvas"
        role="img"
        aria-label="Illustrative live price chart with 12- and 26-period exponential moving averages, MACD momentum histogram and swing-level market structure."
      />
    </div>
  );
}
