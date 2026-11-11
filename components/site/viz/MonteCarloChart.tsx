"use client";

import { useId, useRef, useState } from "react";
import { useCanvasLoop, C } from "./useCanvasLoop";
import {
  gbmMean,
  gbmPath,
  gbmProbBelowStart,
  gbmTerminalPdf,
  mulberry32,
} from "@/lib/site/math";

/**
 * Quantitative Research — hypothesis versus simulation.
 *
 * Batches of geometric Brownian motion paths (S0 = 100, μ = 8%, one year) are
 * drawn; their terminal values accumulate into a histogram that converges on
 * the closed-form lognormal density drawn over it. The readouts compare the
 * analytic E[S_T] and P(S_T < S0) with what the simulation has measured so far.
 * Changing σ restarts the experiment.
 */

const S0 = 100;
const MU = 0.08;
const T = 1;
const STEPS = 126;
const RUN = 2.4; // seconds to draw one batch
const HOLD = 0.7;
const BINS = 36;
const CAP = 6000;

export function MonteCarloChart() {
  const [sigma, setSigma] = useState(0.24);
  const sigmaRef = useRef(sigma);
  sigmaRef.current = sigma;
  const sliderId = useId();

  const st = useRef<{
    rand: () => number;
    sigma: number;
    paths: Float32Array[];
    finals: number[];
    clock: number;
    lo: number;
    hi: number;
    batch: number;
  } | null>(null);

  const newBatch = (n: number) => {
    const s = st.current!;
    s.paths = Array.from({ length: n }, () => gbmPath(S0, MU, s.sigma, T, STEPS, s.rand));
    s.clock = 0;
    s.batch++;
  };

  const { canvasRef, redraw } = useCanvasLoop(({ ctx, w, h, dt, reduce, mono }) => {
    const sig = sigmaRef.current;
    const nPaths = w < 520 ? 36 : 64;
    const bounds = (sg: number) => {
      const m = (MU - (sg * sg) / 2) * T;
      const sd = sg * Math.sqrt(T);
      return [S0 * Math.exp(m - 2.5 * sd), S0 * Math.exp(m + 2.5 * sd)];
    };

    if (!st.current || st.current.sigma !== sig) {
      const prevLo = st.current?.lo;
      const prevHi = st.current?.hi;
      st.current = {
        rand: mulberry32(st.current ? st.current.batch * 7919 + 13 : 99),
        sigma: sig,
        paths: [],
        finals: [],
        clock: 0,
        lo: prevLo ?? bounds(sig)[0],
        hi: prevHi ?? bounds(sig)[1],
        batch: st.current?.batch ?? 0,
      };
      newBatch(nPaths);
      if (reduce) {
        // static frame: show a fully simulated sample
        for (let i = 0; i < 40; i++) {
          for (const p of st.current.paths) st.current.finals.push(p[STEPS]);
          newBatch(nPaths);
        }
        st.current.clock = RUN;
      }
    }
    const s = st.current;

    if (!reduce) {
      s.clock += dt;
      if (s.clock >= RUN + HOLD) {
        for (const p of s.paths) s.finals.push(p[STEPS]);
        if (s.finals.length > CAP) s.finals.splice(0, s.finals.length - CAP);
        newBatch(nPaths);
      }
    }
    const drawn = Math.min(1, s.clock / RUN);
    const upto = Math.max(1, Math.floor(drawn * STEPS));

    const [bLo, bHi] = bounds(sig);
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3);
    s.lo += (bLo - s.lo) * k;
    s.hi += (bHi - s.hi) * k;

    const narrow = w < 520;
    const padT = 30;
    const padB = 18;
    const pathR = narrow ? w * 0.68 : w * 0.72;
    const histL = pathR + 10;
    const histW = w - histL - 4;
    const y = (v: number) => padT + (1 - (v - s.lo) / (s.hi - s.lo)) * (h - padT - padB);
    const x = (i: number) => (i / STEPS) * pathR;

    ctx.clearRect(0, 0, w, h);

    // S0 reference
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y(S0));
    ctx.lineTo(w, y(S0));
    ctx.stroke();

    // paths
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, pathR, h);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(47,191,173,0.17)";
    for (const p of s.paths) {
      ctx.beginPath();
      ctx.moveTo(0, y(p[0]));
      for (let i = 1; i <= upto; i++) ctx.lineTo(x(i), y(p[i]));
      ctx.stroke();
    }
    // analytic expectation S0·e^{μt}
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * T;
      const px = x(i);
      const py = y(gbmMean(S0, MU, t));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // histogram of accumulated terminal values, with the lognormal density
    const range = s.hi - s.lo;
    const bw = range / BINS;
    const counts = new Array(BINS).fill(0);
    for (const f of s.finals) {
      const b = Math.floor((f - s.lo) / bw);
      if (b >= 0 && b < BINS) counts[b]++;
    }
    const n = s.finals.length;
    let pdfMax = 0;
    for (let i = 0; i <= 80; i++) {
      pdfMax = Math.max(pdfMax, gbmTerminalPdf(s.lo + (range * i) / 80, S0, MU, sig, T));
    }
    const scale = histW / (pdfMax * 1.08);
    if (n > 0) {
      ctx.fillStyle = "rgba(74,143,196,0.42)";
      for (let b = 0; b < BINS; b++) {
        const density = counts[b] / (n * bw);
        const top = y(s.lo + (b + 1) * bw);
        const bot = y(s.lo + b * bw);
        ctx.fillRect(histL, top + 0.5, density * scale, Math.max(1, bot - top - 1));
      }
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const v = s.lo + (range * i) / 80;
      const px = histL + gbmTerminalPdf(v, S0, MU, sig, T) * scale;
      const py = y(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // readouts: theory vs. simulation
    const eT = gbmMean(S0, MU, T);
    const pT = gbmProbBelowStart(MU, sig, T);
    const eS = n ? s.finals.reduce((a, b) => a + b, 0) / n : NaN;
    const pS = n ? s.finals.filter((f) => f < S0).length / n : NaN;
    ctx.font = `11px ${mono}`;
    ctx.textBaseline = "alphabetic";
    let tx = 0;
    const put = (label: string, val: string, color: string) => {
      ctx.fillStyle = C.muted;
      ctx.fillText(label, tx, 14);
      tx += ctx.measureText(label).width + 6;
      ctx.fillStyle = color;
      ctx.fillText(val, tx, 14);
      tx += ctx.measureText(val).width + 16;
    };
    put("E[S_T]", eT.toFixed(1), C.ink);
    put("sim", n ? eS.toFixed(1) : "—", C.teal);
    if (!narrow) {
      put("P(S_T<S_0)", `${(pT * 100).toFixed(1)}%`, C.ink);
      put("sim", n ? `${(pS * 100).toFixed(1)}%` : "—", C.teal);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = C.faint;
    ctx.fillText(`n = ${n.toLocaleString("en-US")}`, w - 4, 14);
    ctx.textAlign = "left";
  });

  return (
    <div className="rdc-viz">
      <canvas
        ref={canvasRef}
        className="rdc-viz-canvas"
        role="img"
        aria-label={`Monte Carlo simulation of geometric Brownian motion with ${Math.round(sigma * 100)}% volatility; terminal values converge on the analytic lognormal density.`}
      />
      <div className="rdc-viz-control">
        <label htmlFor={sliderId}>
          Volatility <span className="rdc-sym">σ</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={10}
          max={50}
          step={1}
          value={Math.round(sigma * 100)}
          onChange={(e) => {
            setSigma(Number(e.target.value) / 100);
            requestAnimationFrame(redraw);
          }}
        />
        <output htmlFor={sliderId}>{Math.round(sigma * 100)}%</output>
      </div>
    </div>
  );
}
