"use client";

import { useId, useRef, useState } from "react";
import { useCanvasLoop, C } from "./useCanvasLoop";
import { dcfValue, gaussian, mulberry32 } from "@/lib/site/math";

/**
 * Fundamental Analysis — price versus intrinsic value.
 *
 * Intrinsic value is a real two-stage DCF (FCF 1.80/share, 9% growth for five
 * years, 2.5% terminal growth). The discount-rate control re-prices it; the
 * shaded band is the ±0.5pt discount-rate sensitivity. The illustrative market
 * price mean-reverts toward value, so the margin of safety opens and closes.
 * The right panel draws V(r) itself.
 */

const INPUTS = { fcf0: 1.8, growth: 0.09, terminalGrowth: 0.025, years: 5 };
const R_MIN = 0.07;
const R_MAX = 0.13;
const N = 150;
const STEP = 0.16; // seconds per new price point

const value = (r: number) => dcfValue({ ...INPUTS, discount: r });

export function ValuationChart() {
  const [rate, setRate] = useState(0.09);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const sliderId = useId();

  const sim = useRef<{
    rand: () => number;
    prices: number[];
    noise: number;
    next: number;
    acc: number;
    vShown: number;
    lo: number;
    hi: number;
  } | null>(null);

  const { canvasRef, redraw } = useCanvasLoop(({ ctx, w, h, dt, reduce, mono }) => {
    const r = rateRef.current;
    const v = value(r);

    if (!sim.current) {
      const rand = mulberry32(42);
      const prices: number[] = [];
      let p = v * 0.86;
      let e = 0;
      for (let i = 0; i < N; i++) {
        e = 0.82 * e + 0.18 * gaussian(rand);
        p += 0.035 * (v - p) + e * 0.9;
        prices.push(p);
      }
      sim.current = { rand, prices, noise: e, next: p, acc: 0, vShown: v, lo: v * 0.6, hi: v * 1.3 };
    }
    const s = sim.current;

    // Intrinsic value glides to the new DCF output instead of jumping.
    s.vShown = reduce ? v : s.vShown + (v - s.vShown) * (1 - Math.exp(-dt * 5));
    const vs = s.vShown;

    const stepPrice = () => {
      s.noise = 0.82 * s.noise + 0.18 * gaussian(s.rand);
      const last = s.prices[s.prices.length - 1];
      return last + 0.035 * (vs - last) + s.noise * 0.9;
    };
    if (!reduce) {
      s.acc += dt;
      while (s.acc >= STEP) {
        s.acc -= STEP;
        s.prices.push(s.next);
        s.prices.shift();
        s.next = stepPrice();
      }
    }
    const phase = reduce ? 0 : s.acc / STEP;
    const tip = s.prices[s.prices.length - 1] + (s.next - s.prices[s.prices.length - 1]) * phase;

    // Layout: time series left, V(r) right.
    const narrow = w < 520;
    const padT = 30;
    const padB = 26;
    const leftW = narrow ? w : w * 0.7;
    const plotR = leftW - 12;
    const rightX = leftW + 18;
    const rightW = w - rightX - 10;

    const vHi = value(Math.max(R_MIN, r - 0.005));
    const vLo = value(Math.min(R_MAX, r + 0.005));
    let lo = Math.min(...s.prices, tip, vLo);
    let hi = Math.max(...s.prices, tip, vHi);
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3);
    s.lo += (lo - s.lo) * k;
    s.hi += (hi - s.hi) * k;
    const y = (p: number) => padT + (1 - (p - s.lo) / (s.hi - s.lo)) * (h - padT - padB);
    const dx = (plotR - 4) / (N - 1);
    const x = (i: number) => 4 + (i - phase) * dx;

    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const gy = padT + ((h - padT - padB) * g) / 4;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(plotR, gy);
      ctx.stroke();
    }

    // discount-rate sensitivity band (±0.5pt)
    ctx.fillStyle = "rgba(47, 191, 173, 0.06)";
    ctx.fillRect(0, y(vHi), plotR, y(vLo) - y(vHi));

    // margin-of-safety fill between price and value
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotR, h);
    ctx.clip();
    for (const below of [true, false]) {
      ctx.beginPath();
      ctx.moveTo(x(0), y(vs));
      for (let i = 0; i < N; i++) {
        const p = s.prices[i];
        ctx.lineTo(x(i), y(below ? Math.min(p, vs) : Math.max(p, vs)));
      }
      ctx.lineTo(x(N - 1) + dx * phase, y(below ? Math.min(tip, vs) : Math.max(tip, vs)));
      ctx.lineTo(x(N - 1) + dx * phase, y(vs));
      ctx.closePath();
      ctx.fillStyle = below ? C.tealSoft : C.coralSoft;
      ctx.fill();
    }

    // intrinsic value
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y(vs));
    ctx.lineTo(plotR, y(vs));
    ctx.stroke();

    // price
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = x(i);
      const py = y(s.prices[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineTo(x(N - 1) + dx * phase, y(tip));
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x(N - 1) + dx * phase, y(tip), 2.6, 0, Math.PI * 2);
    ctx.fill();

    // readouts
    const margin = vs / tip - 1;
    ctx.font = `11px ${mono}`;
    ctx.textBaseline = "alphabetic";
    let tx = 0;
    const put = (label: string, val: string, color: string) => {
      ctx.fillStyle = C.muted;
      ctx.fillText(label, tx, 14);
      tx += ctx.measureText(label).width + 6;
      ctx.fillStyle = color;
      ctx.fillText(val, tx, 14);
      tx += ctx.measureText(val).width + 18;
    };
    put("Value", vs.toFixed(2), C.teal);
    put("Price", tip.toFixed(2), C.ink);
    put("Margin", `${margin >= 0 ? "+" : "−"}${Math.abs(margin * 100).toFixed(1)}%`, margin >= 0 ? C.teal : C.coral);

    if (narrow) return;

    // V(r): the valuation curve itself
    const vy = (val: number) => padT + (1 - (val - 20) / (60 - 20)) * (h - padT - padB);
    const rx = (rr: number) => rightX + ((rr - R_MIN) / (R_MAX - R_MIN)) * rightW;
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(rightX, h - padB);
    ctx.lineTo(rightX + rightW, h - padB);
    ctx.stroke();
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const rr = R_MIN + ((R_MAX - R_MIN) * i) / 60;
      const px = rx(rr);
      const py = vy(value(rr));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = C.teal;
    ctx.beginPath();
    ctx.arc(rx(r), vy(v), 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = `10px ${mono}`;
    ctx.fillText("V(r)", rightX, 14);
    ctx.fillText("7%", rightX, h - 8);
    ctx.textAlign = "right";
    ctx.fillText("13%", rightX + rightW, h - 8);
    ctx.textAlign = "left";
  });

  return (
    <div className="rdc-viz">
      <canvas ref={canvasRef} className="rdc-viz-canvas" role="img"
        aria-label={`Illustrative discounted cash flow: intrinsic value ${value(rate).toFixed(2)} at a ${(rate * 100).toFixed(1)}% discount rate, versus a simulated market price.`} />
      <div className="rdc-viz-control">
        <label htmlFor={sliderId}>Discount rate</label>
        <input
          id={sliderId}
          type="range"
          min={R_MIN * 1000}
          max={R_MAX * 1000}
          step={1}
          value={Math.round(rate * 1000)}
          onChange={(e) => {
            setRate(Number(e.target.value) / 1000);
            requestAnimationFrame(redraw);
          }}
        />
        <output htmlFor={sliderId}>{(rate * 100).toFixed(1)}%</output>
      </div>
    </div>
  );
}
