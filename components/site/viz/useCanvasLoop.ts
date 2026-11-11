"use client";

import { useEffect, useRef } from "react";

export interface FrameInfo {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels */
  w: number;
  h: number;
  /** seconds since last frame (0 for a static redraw) */
  dt: number;
  /** wall seconds since mount */
  t: number;
  reduce: boolean;
  mono: string;
}

/**
 * Drives a 2D canvas chart: DPR-correct sizing on resize, a rAF loop that runs
 * only while the canvas is on screen, and a single static frame under
 * prefers-reduced-motion. The draw callback is read from a ref, so React never
 * re-renders per frame.
 */
export function useCanvasLoop(draw: (f: FrameInfo) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mono =
      getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() ||
      "ui-monospace, monospace";

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    const t0 = last;

    const frame = (dt: number) => {
      if (!w || !h) return;
      drawRef.current({ ctx, w, h, dt, t: (performance.now() - t0) / 1000, reduce, mono });
    };

    const size = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frame(0);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduce || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    redrawRef.current = () => frame(0);

    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(canvas);
    size();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return { canvasRef, redraw: () => redrawRef.current() };
}

/** Shared palette for the canvas charts (mirrors the site CSS tokens). */
export const C = {
  ink: "rgba(232, 237, 235, 0.92)",
  muted: "rgba(150, 163, 168, 0.75)",
  faint: "rgba(150, 163, 168, 0.35)",
  grid: "rgba(255, 255, 255, 0.055)",
  teal: "#2FBFAD",
  tealSoft: "rgba(47, 191, 173, 0.14)",
  blue: "#4A8FC4",
  coral: "#C9806F",
  coralSoft: "rgba(201, 128, 111, 0.12)",
};
