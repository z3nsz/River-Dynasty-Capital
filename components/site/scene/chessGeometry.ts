/**
 * The Strategy scene: a flat chess emblem drawn in dots — a king in front, a
 * knight (facing left) and a rook behind it, standing on four dark diamonds.
 *
 * The shapes are traced from the reference emblem (chessEmblem.ts): every
 * dark region of the drawing as a polygon, including the thin light gaps that
 * separate the king from the pieces behind it. Here they are filled with
 * dots: a jittered lattice inside, smaller dots packed along every edge.
 *
 * Computed once on the CPU and passed to the vertex shader as aChess,
 * centred on the origin: x, y position and, in z, the dot's size factor
 * (the emblem is flat, so z carries no depth).
 */

import { EMBLEM } from "./chessEmblem";

const SCALE = 0.92;
const DENSITY = 0.55;

/** Each polygon's bounding box, to skip far-away shapes quickly. */
const BOXES = EMBLEM.map((poly) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
});

/** Even-odd test against every polygon, so any enclosed gap stays empty. */
function inside(x: number, y: number): boolean {
  let hit = false;
  for (let p = 0; p < EMBLEM.length; p++) {
    const b = BOXES[p];
    // a ray cast toward +x can only cross polygons spanning y and lying to the right
    if (y < b.y0 || y > b.y1 || x > b.x1) continue;
    const poly = EMBLEM[p];
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
  for (let p = 0; p < EMBLEM.length; p++) {
    const b = BOXES[p];
    if (x < b.x0 - limit || x > b.x1 + limit || y < b.y0 - limit || y > b.y1 + limit) continue;
    const poly = EMBLEM[p];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const ex = x - ax - t * dx;
      const ey = y - ay - t * dy;
      if (ex * ex + ey * ey < limit * limit) return true;
    }
  }
  return false;
}

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
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

/** A dot: position and size factor. */
type Dot = [number, number, number];

/**
 * The whole emblem at spacing `step`. No drawn outline and no rigid grid:
 * body dots sit on a jittered lattice (even coverage, organic look, sizes
 * varying a little); a band of smaller, tighter dots fills in along every
 * edge so the silhouettes stay crisp.
 */
function emblem(step: number): Dot[] {
  const { x0, x1, y0, y1 } = BOUNDS;
  const out: Dot[] = [];
  const band = step * 0.55;
  let n = 0;
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      n++;
      const px = x + (rand(n) - 0.5) * step * 0.7;
      const py = y + (rand(n + 0.5) - 0.5) * step * 0.7;
      if (!inside(px, py) || nearEdge(px, py, band)) continue;
      out.push([px, py, 0.8 + 0.4 * rand(n + 0.25)]);
    }
  }
  const fine = step * 0.5;
  for (let y = y0 + fine / 2; y < y1; y += fine) {
    for (let x = x0 + fine / 2; x < x1; x += fine) {
      n++;
      const px = x + (rand(n) - 0.5) * fine * 0.6;
      const py = y + (rand(n + 0.5) - 0.5) * fine * 0.6;
      if (!inside(px, py) || !nearEdge(px, py, band)) continue;
      out.push([px, py, 0.45 + 0.15 * rand(n + 0.25)]);
    }
  }
  return out;
}

export function chessGeometry(count: number): Float32Array {
  // Pick the spacing that uses the particle budget in one correction. Body
  // dots scale with 1/step², edge-band dots with 1/step, so with u = s0/step
  // the count is body·u² + edge·u: solve that quadratic for u.
  const s0 = 0.06;
  const first = emblem(s0);
  const edge = first.filter((d) => d[2] < 0.7).length;
  const body = first.length - edge;
  // Only ~55% of the particles get distinct dots, so the spacing matches the
  // other scenes (the pie chart's, roughly); the rest double up unseen.
  const target = count * DENSITY;
  const u = (-edge + Math.sqrt(edge * edge + 4 * body * target)) / (2 * body);
  const pts = emblem(s0 / u);

  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const cy = (BOUNDS.y0 + BOUNDS.y1) / 2;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y, size] = pts[i % pts.length];
    out[i * 3] = (x - cx) * SCALE;
    out[i * 3 + 1] = (y - cy) * SCALE;
    out[i * 3 + 2] = size; // the shader reads z as this dot's size, not depth
  }
  return out;
}
