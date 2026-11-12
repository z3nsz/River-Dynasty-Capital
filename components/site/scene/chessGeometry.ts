/**
 * The Strategy scene: a flat chess emblem drawn in dots. A king in front, a
 * knight (facing left) and a rook behind it, standing on four dark diamonds.
 * No 3D: every shape is a 2D silhouette in the screen plane, filled with an
 * even lattice of dots and traced with a denser outline. Where the king
 * stands in front of the other pieces, their dots are removed with a thin
 * margin, so the overlap reads as a clean cut-out gap, emblem style.
 *
 * Computed once on the CPU and passed to the vertex shader as aChess.
 * Units: 1 = 100 px of the reference drawing; x right, y up, king's base at 0.
 */

type V2 = [number, number];
type Pt = [number, number, number];

const SCALE = 0.92;

/** Reference-drawing pixels → scene units (king centre x = 345, base y = 335). */
const px = (x: number, y: number): V2 => [(x - 345) / 100, (335 - y) / 100];

/** A left–right symmetric outline from a half-profile [halfWidth, y] list. */
function mirrored(cx: number, half: V2[]): V2[] {
  const right = half.map(([w, y]) => [cx + w, y] as V2);
  const left = [...half].reverse().map(([w, y]) => [cx - w, y] as V2);
  return [...right, ...left];
}

// King: three-tier base, rounded collar, tapering stem, ring, flared crown.
const KING = mirrored(0, [
  [0.76, 0], [0.76, 0.1], [0.7, 0.1], [0.7, 0.2], [0.62, 0.2], [0.62, 0.28],
  [0.55, 0.32], [0.48, 0.42], [0.3, 0.5], [0.22, 0.54], [0.19, 0.9], [0.15, 1.5],
  [0.13, 1.84], [0.36, 1.86], [0.36, 1.96], [0.15, 1.98], [0.15, 2.06],
  [0.24, 2.14], [0.36, 2.36], [0.37, 2.44], [0.3, 2.5], [0.18, 2.52], [0.18, 2.6],
  [0.045, 2.6],
]);
// Cross on top: a vertical bar and a cross-bar.
const CROSS_V: V2[] = [[-0.045, 2.6], [0.045, 2.6], [0.045, 3.0], [-0.045, 3.0]];
const CROSS_H: V2[] = [[-0.14, 2.74], [0.14, 2.74], [0.14, 2.84], [-0.14, 2.84]];

// Rook: moulded base, straight body, collar, crenellated top (3 merlons).
const ROOK_X = 0.96;
const ROOK_Y = 0.17;
const ROOK: V2[] = (() => {
  const half: V2[] = [
    [0.5, 0], [0.5, 0.12], [0.44, 0.12], [0.44, 0.2], [0.38, 0.26], [0.33, 0.32],
    [0.3, 1.42], [0.38, 1.46], [0.38, 1.55], [0.44, 1.6], [0.44, 2.0],
  ];
  const right = half.map(([w, y]) => [ROOK_X + w, ROOK_Y + y] as V2);
  // battlements across the top, right to left: merlon, gap, merlon, gap, merlon
  const top = ROOK_Y + 2.0;
  const notch = ROOK_Y + 1.82;
  const crown: V2[] = [
    [ROOK_X + 0.27, top], [ROOK_X + 0.27, notch], [ROOK_X + 0.09, notch], [ROOK_X + 0.09, top],
    [ROOK_X - 0.09, top], [ROOK_X - 0.09, notch], [ROOK_X - 0.27, notch], [ROOK_X - 0.27, top],
  ];
  const left = [...half].reverse().map(([w, y]) => [ROOK_X - w, ROOK_Y + y] as V2);
  return [...right, ...crown, ...left];
})();

// Knight, facing left: traced from the reference drawing.
const KNIGHT: V2[] = [
  // base, then up the back of the neck and the mane
  px(190, 318), px(305, 318), px(305, 306), px(298, 298), px(300, 296),
  px(305, 255), px(305, 215), px(300, 175), px(288, 145), px(270, 121),
  px(252, 108), px(242, 112),
  // ear: a sharp point, then down the forehead and the long face
  px(232, 96), px(224, 117), px(210, 140), px(197, 162),
  // muzzle: a pointed tip, the underside, then the small mouth notch
  px(183, 183), px(196, 187), px(206, 192), px(198, 197),
  // chin, jaw line, throat, chest
  px(207, 204), px(226, 206), px(234, 216), px(224, 240), px(212, 264),
  px(208, 296), px(196, 298), px(190, 306),
];

// Board: dark diamonds of a 3×3 board drawn flat, as in the emblem (the far
// square is hidden behind the pieces, so it is left out).
const A = 0.95; // half-width of a diamond
const B = 0.3; // half-height
const diamond = (cx: number, cy: number): V2[] => {
  const a = A * 0.97;
  const b = B * 0.97;
  return [[cx - a, cy], [cx, cy - b], [cx + a, cy], [cx, cy + b]];
};
const BOARD_Y = -0.12;
const BOARD = [
  diamond(0, BOARD_Y),
  diamond(-2 * A, BOARD_Y),
  diamond(2 * A, BOARD_Y),
  diamond(0, BOARD_Y - 2 * B),
];

// ---------------------------------------------------------------- geometry

function inside(poly: V2[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance(poly: V2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Inside, or within `margin` of, any of the shapes. */
const covered = (shapes: V2[][], x: number, y: number, margin: number) =>
  shapes.some((s) => inside(s, x, y) || edgeDistance(s, x, y) < margin);

/** An even lattice of dots inside `poly`, plus its outline at tighter spacing. */
function dots(poly: V2[], step: number): V2[] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const out: V2[] = [];
  // Fill dots stay a little back from the edge so the outline reads as one
  // clean line instead of a ragged fringe.
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (inside(poly, x, y) && edgeDistance(poly, x, y) > step * 0.5) out.push([x, y]);
    }
  }
  const s = step * 0.45;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / s));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** The whole emblem at lattice spacing `step`, front to back with cut-outs. */
function emblem(step: number): V2[] {
  const gap = 0.1;
  const king = [KING, CROSS_V, CROSS_H];
  const front = king.flatMap((p) => dots(p, step));
  const back = [KNIGHT, ROOK]
    .flatMap((p) => dots(p, step))
    .filter(([x, y]) => !covered(king, x, y, gap));
  const board = BOARD.flatMap((p) => dots(p, step)).filter(
    ([x, y]) => !covered([...king, KNIGHT, ROOK], x, y, gap),
  );
  return [...board, ...back, ...front];
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

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y] = pts[i % pts.length];
    out[i * 3] = x * SCALE;
    out[i * 3 + 1] = y * SCALE;
    out[i * 3 + 2] = 0;
  }
  return out;
}
