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
 * Geometric Brownian motion paths (S0 = 100, μ = 8%, one year) launch in a
 * continuous stream. Each one is traced out with a moving head; when it reaches
 * maturity its terminal value travels across into the histogram, whose bars
 * grow toward the counts and converge on the closed-form lognormal density.
 * Readouts compare the analytic E[S_T] and P(S_T < S0) with the running
 * simulation. Changing σ restarts the experiment.
 */

const S0 = 100;
const MU = 0.08;
const T = 1;
const STEPS = 126;
const DRAW = 1.9; // seconds to trace one path
const FLY = 0.45; // seconds for the terminal value to reach the histogram
const LINGER = 0.9; // seconds a finished path stays visible
const BINS = 36;
const CAP = 6000;

interface Live {
  data: Float32Array;
  born: number;
  sent: boolean; // terminal value already sent to the histogram
}
interface Flyer {
  v: number;
  born: number;
}

export function MonteCarloChart() {
  const [sigma, setSigma] = useState(0.24);
  const sigmaRef = useRef(sigma);
  sigmaRef.current = sigma;
  const sliderId = useId();

  const st = useRef<{
    rand: () => number;
    sigma: number;
    clock: number;
    nextSpawn: number;
    live: Live[];
    flyers: Flyer[];
    finals: number[];
    bars: Float32Array; // displayed densities, eased toward the counts
    flash: Float32Array; // per-bin highlight when a value lands
    lo: number;
    hi: number;
    gen: number;
  } | null>(null);

  const { canvasRef, redraw } = useCanvasLoop(({ ctx, w, h, dt, reduce, mono }) => {
    const sig = sigmaRef.current;
    const narrow = w < 520;
    const spawnEvery = narrow ? 0.09 : 0.055;
    const bounds = (sg: number) => {
      const m = (MU - (sg * sg) / 2) * T;
      const sd = sg * Math.sqrt(T);
      return [S0 * Math.exp(m - 2.5 * sd), S0 * Math.exp(m + 2.5 * sd)];
    };

    if (!st.current || st.current.sigma !== sig) {
      const prev = st.current;
      const gen = (prev?.gen ?? 0) + 1;
      st.current = {
        rand: mulberry32(gen * 7919 + 13),
        sigma: sig,
        clock: 0,
        nextSpawn: 0,
        live: [],
        flyers: [],
        finals: [],
        bars: new Float32Array(BINS),
        flash: new Float32Array(BINS),
        lo: prev?.lo ?? bounds(sig)[0],
        hi: prev?.hi ?? bounds(sig)[1],
        gen,
      };
      if (reduce) {
        // Static frame: a fully simulated sample plus a fan of finished paths.
        const s = st.current;
        for (let i = 0; i < 2500; i++) s.finals.push(gbmPath(S0, MU, sig, T, STEPS, s.rand)[STEPS]);
        for (let i = 0; i < 50; i++) s.live.push({ data: gbmPath(S0, MU, sig, T, STEPS, s.rand), born: -DRAW, sent: true });
      }
    }
    const s = st.current;

    // --- simulate ---------------------------------------------------------
    if (!reduce) {
      s.clock += dt;
      while (s.clock >= s.nextSpawn) {
        s.live.push({ data: gbmPath(S0, MU, sig, T, STEPS, s.rand), born: s.nextSpawn, sent: false });
        s.nextSpawn += spawnEvery;
      }
      for (const p of s.live) {
        if (!p.sent && s.clock - p.born >= DRAW) {
          p.sent = true;
          s.flyers.push({ v: p.data[STEPS], born: s.clock });
        }
      }
      s.live = s.live.filter((p) => s.clock - p.born < DRAW + LINGER);
    }

    const [bLo, bHi] = bounds(sig);
    const ease = reduce ? 1 : 1 - Math.exp(-dt * 3);
    s.lo += (bLo - s.lo) * ease;
    s.hi += (bHi - s.hi) * ease;
    const range = s.hi - s.lo;
    const bw = range / BINS;

    // landed values join the sample and light their bin
    s.flyers = s.flyers.filter((f) => {
      if (s.clock - f.born < FLY) return true;
      s.finals.push(f.v);
      const b = Math.floor((f.v - s.lo) / bw);
      if (b >= 0 && b < BINS) s.flash[b] = 1;
      return false;
    });
    if (s.finals.length > CAP) s.finals.splice(0, s.finals.length - CAP);

    // --- layout -----------------------------------------------------------
    const padT = 30;
    const padB = 18;
    const pathR = narrow ? w * 0.66 : w * 0.7;
    const histL = pathR + 14;
    const histW = w - histL - 4;
    const y = (v: number) => padT + (1 - (v - s.lo) / range) * (h - padT - padB);
    const x = (i: number) => (i / STEPS) * pathR;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y(S0));
    ctx.lineTo(w, y(S0));
    ctx.stroke();

    // --- paths, each traced with a moving head ----------------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, pathR + 3, h);
    ctx.clip();
    for (const p of s.live) {
      const age = s.clock - p.born;
      const prog = Math.min(1, age / DRAW);
      const fade = age > DRAW ? 1 - (age - DRAW) / LINGER : 1;
      const f = prog * STEPS;
      const upto = Math.floor(f);
      const frac = f - upto;
      ctx.strokeStyle = `rgba(47,191,173,${(0.2 * fade).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y(p.data[0]));
      for (let i = 1; i <= upto; i++) ctx.lineTo(x(i), y(p.data[i]));
      let hx = x(upto);
      let hy = y(p.data[upto]);
      if (upto < STEPS) {
        hx = x(upto + frac);
        hy = y(p.data[upto] + (p.data[upto + 1] - p.data[upto]) * frac);
        ctx.lineTo(hx, hy);
      }
      ctx.stroke();
      if (prog < 1) {
        ctx.fillStyle = "rgba(160,232,222,0.85)";
        ctx.beginPath();
        ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // analytic expectation S0·e^{μt}
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const px = x(i);
      const py = y(gbmMean(S0, MU, (i / STEPS) * T));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // terminal values flying into the histogram
    for (const fl of s.flyers) {
      const k = Math.min(1, (s.clock - fl.born) / FLY);
      const e = k * k * (3 - 2 * k);
      ctx.fillStyle = `rgba(160,232,222,${(1 - 0.5 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pathR + (histL - pathR) * e + 2, y(fl.v), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- histogram, easing toward the counts ------------------------------
    const counts = new Array(BINS).fill(0);
    for (const v of s.finals) {
      const b = Math.floor((v - s.lo) / bw);
      if (b >= 0 && b < BINS) counts[b]++;
    }
    const n = s.finals.length;
    let pdfMax = 0;
    for (let i = 0; i <= 80; i++) pdfMax = Math.max(pdfMax, gbmTerminalPdf(s.lo + (range * i) / 80, S0, MU, sig, T));
    const scale = histW / (pdfMax * 1.08);
    const grow = reduce ? 1 : 1 - Math.exp(-dt * 6);
    for (let b = 0; b < BINS; b++) {
      const target = n ? counts[b] / (n * bw) : 0;
      s.bars[b] += (target - s.bars[b]) * grow;
      s.flash[b] = reduce ? 0 : Math.max(0, s.flash[b] - dt * 2.5);
      const top = y(s.lo + (b + 1) * bw);
      const bot = y(s.lo + b * bw);
      const a = 0.38 + 0.4 * s.flash[b];
      ctx.fillStyle = `rgba(74,143,196,${a.toFixed(3)})`;
      ctx.fillRect(histL, top + 0.5, s.bars[b] * scale, Math.max(1, bot - top - 1));
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

    // --- readouts: theory vs. simulation ----------------------------------
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
