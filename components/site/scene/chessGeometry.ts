/**
 * The Strategy scene: the chess trio — a knight facing left, the king in the
 * middle, a rook on the right — drawn as halftone dots, taken dot for dot
 * from the reference icon (chessTrio.ts). Small dots trace the edges, large
 * dots fill the bodies, and each dot's ink weight shades the pieces.
 *
 * A little depth: the king stands in front of the knight and the rook, and
 * each piece has some thickness (the particles beyond the reference's dot
 * count sit behind the front dots, fainter), so the gentle turn in the shader
 * shows volume.
 *
 * Passed to the vertex shader as aChess, centred on the origin: x, y, z, and
 * in w the dot's brightness and size packed together:
 * floor(w) = brightness × 100, fract(w) = size factor ÷ 2.
 */

import { TRIO } from "./chessTrio";

const HEIGHT = 4.0;        // the trio's height in scene units
const DEPTH = [-0.12, 0.18, -0.12]; // knight, king, rook
const THICK = 0.22;        // how far the back dots reach behind the front

/** Deterministic pseudo-random in [0, 1). */
function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function chessGeometry(count: number): Float32Array {
  const n = TRIO.length / 5;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < n; j++) {
    const x = TRIO[j * 5], y = TRIO[j * 5 + 1], r = TRIO[j * 5 + 2];
    x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
  }
  const s = HEIGHT / (y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const j = i % n;
    const back = i >= n;  // a repeat: one of the back dots
    const [x, y, r, ink, piece] = TRIO.slice(j * 5, j * 5 + 5);
    out[i * 4] = (x - cx) * s;
    out[i * 4 + 1] = (cy - y) * s;
    out[i * 4 + 2] = DEPTH[piece] - (back ? THICK * (0.25 + 0.75 * rand(i)) : 0);
    // ink 0.65–0.97 on paper → brightness 0.5–1 on the dark page
    const bright = (0.5 + 0.5 * Math.min(1, Math.max(0, (ink - 0.65) / 0.32))) * (back ? 0.4 : 1);
    const size = r / 2.5;   // radius 1.8–4.6 px → size factor 0.7–1.85
    out[i * 4 + 3] = Math.floor(bright * 100) + Math.min(0.999, size / 2);
  }
  return out;
}
