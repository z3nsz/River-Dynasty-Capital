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
 * plus 10 on board dots (the emblem is flat, so z carries no depth).
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

/** The board squares: the only shapes reaching well below the pieces' base. */
const BOARD = EMBLEM.filter((poly) => Math.min(...poly.map((q) => q[1])) < -0.3);

function onBoard(x: number, y: number): boolean {
  return BOARD.some((poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  });
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

function insidePoly(poly: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function areaOf(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a) / 2;
}

/** Tiny shapes (the king's cross and the plate under it): filled solid with fine dots. */
const SMALL = EMBLEM.map((poly) => areaOf(poly) < 0.06);

/**
 * The whole emblem at spacing `step`. No drawn outline and no rigid grid:
 *  - body dots on a jittered lattice, kept back from the edges;
 *  - edge dots that follow each boundary just inside it, small and evenly
 *    spaced with only a slight wobble, so every edge (the rook's
 *    battlements, the knight's muzzle) reads crisp;
 *  - tiny shapes filled solid with fine dots so the cross reads as a cross.
 * The size factor tells the shader which kind each dot is: under 0.45 a
 * tiny-shape dot, 0.45–0.7 an edge dot, otherwise a body dot.
 */
function emblem(step: number): Dot[] {
  const { x0, x1, y0, y1 } = BOUNDS;
  const out: Dot[] = [];
  const band = step * 0.5;
  let n = 0;

  // body
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      n++;
      const px = x + (rand(n) - 0.5) * step * 0.7;
      const py = y + (rand(n + 0.5) - 0.5) * step * 0.7;
      if (!inside(px, py) || nearEdge(px, py, band)) continue;
      if (EMBLEM.some((poly, k) => SMALL[k] && insidePoly(poly, px, py))) continue;
      out.push([px, py, 0.8 + 0.4 * rand(n + 0.25)]);
    }
  }

  // edges: walk every boundary, a dot every `gap`, set just inside the shape
  const gap = step * 0.5;
  const inset = step * 0.18;
  EMBLEM.forEach((poly, k) => {
    if (SMALL[k]) return;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) continue;
      let nx = -(by - ay) / len;
      let ny = (bx - ax) / len;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      if (!insidePoly(poly, mx + nx * 0.01, my + ny * 0.01)) {
        nx = -nx;
        ny = -ny;
      }
      const m = Math.max(1, Math.round(len / gap));
      for (let q = 0; q < m; q++) {
        n++;
        const t = (q + 0.5) / m;
        const w = inset + (rand(n) - 0.5) * step * 0.12;
        out.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w, 0.5 + 0.1 * rand(n + 0.5)]);
      }
    }
  });

  // tiny shapes: solid fine fill
  const fine = step * 0.38;
  EMBLEM.forEach((poly, k) => {
    if (!SMALL[k]) return;
    const b = BOXES[k];
    for (let y = b.y0 + fine / 2; y < b.y1; y += fine) {
      for (let x = b.x0 + fine / 2; x < b.x1; x += fine) {
        n++;
        const px = x + (rand(n + 0.3) - 0.5) * fine * 0.3;
        const py = y + (rand(n + 0.7) - 0.5) * fine * 0.3;
        if (insidePoly(poly, px, py)) out.push([px, py, 0.3 + 0.1 * rand(n)]);
      }
    }
  });
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
    // z is not depth (the emblem is flat): it carries the dot's size factor,
    // plus 10 for board dots, which stay put while the pieces bounce.
    out[i * 3 + 2] = size + (onBoard(x, y) ? 10 : 0);
  }
  return out;
}
