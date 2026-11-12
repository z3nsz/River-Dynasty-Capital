/**
 * The Strategy scene: a flat chess emblem drawn in dots — a king in front, a
 * knight (facing left) and a rook behind it, standing on four dark diamonds.
 *
 * The shapes are traced from the reference emblem (chessEmblem.ts): every
 * dark region of the drawing as a polygon, including the thin light gaps that
 * separate the king from the pieces behind it. Here they are filled with an
 * even lattice of dots, kept slightly back from each edge, and traced with a
 * tighter line of dots so the silhouettes read cleanly.
 *
 * Computed once on the CPU and passed to the vertex shader as aChess,
 * centred on the origin. No 3D: z is always 0.
 */

import { EMBLEM } from "./chessEmblem";

type V2 = [number, number];

const SCALE = 0.92;

/** Even-odd test against every polygon, so any enclosed gap stays empty. */
function inside(x: number, y: number): boolean {
  let hit = false;
  for (const poly of EMBLEM) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

/** Whether (x, y) lies within `limit` of any edge. */
function nearEdge(x: number, y: number, limit: number): boolean {
  for (const poly of EMBLEM) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - ax - t * dx, y - ay - t * dy) < limit) return true;
    }
  }
  return false;
}

const BOUNDS = (() => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const poly of EMBLEM) {
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1 };
})();

/** The whole emblem at lattice spacing `step`: fill, then outlines. */
function emblem(step: number): V2[] {
  const { x0, x1, y0, y1 } = BOUNDS;
  const out: V2[] = [];
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (inside(x, y) && !nearEdge(x, y, step * 0.5)) out.push([x, y]);
    }
  }
  const s = step * 0.45;
  for (const poly of EMBLEM) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / s));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
  }
  return out;
}

export function chessGeometry(count: number): Float32Array {
  // Pick the spacing that uses the particle budget: dot count scales with
  // 1/step², so a couple of corrections land within a few percent.
  let step = 0.06;
  let pts = emblem(step);
  for (let i = 0; i < 3; i++) {
    step *= Math.sqrt(pts.length / count) * 1.01;
    pts = emblem(step);
  }

  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const cy = (BOUNDS.y0 + BOUNDS.y1) / 2;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y] = pts[i % pts.length];
    out[i * 3] = (x - cx) * SCALE;
    out[i * 3 + 1] = (y - cy) * SCALE;
    out[i * 3 + 2] = 0;
  }
  return out;
}
