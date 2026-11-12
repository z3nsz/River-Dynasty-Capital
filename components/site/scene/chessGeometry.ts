/**
 * The Strategy scene: a chessboard with a king, rook, knight and pawn, as one
 * point cloud. Computed once on the CPU (the knight's silhouette is easier to
 * sample here than in a shader) and handed to the vertex shader as a
 * per-particle attribute; the shader only rotates it.
 *
 * Coordinates: board centred on the origin at y = 0, square size S, +z toward
 * the viewer. Turned pieces (king, rook, pawn) are lathes — stacked rings with
 * dots spread in proportion to circumference so density stays even. The knight
 * is its classic profile, sampled by arc length and extruded in depth.
 */

const S = 0.55;
const TAU = Math.PI * 2;

type Pt = [number, number, number];
type Profile = (h: number) => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (h: number, h0: number, h1: number, r0: number, r1: number) =>
  lerp(r0, r1, Math.min(1, Math.max(0, (h - h0) / (h1 - h0))));
const ball = (h: number, c: number, rad: number, scale: number) =>
  (Math.sqrt(Math.max(0, rad * rad - (h - c) * (h - c))) / rad) * scale;

/** Board square (file 0–7, rank 0–7) → centre. Rank 7 is nearest the viewer. */
const square = (file: number, rank: number): [number, number] => [
  (file - 3.5) * S,
  (rank - 3.5) * S,
];

const kingProfile: Profile = (h) => {
  if (h < 0.06) return seg(h, 0, 0.06, 0.62, 0.58);
  if (h < 0.12) return seg(h, 0.06, 0.12, 0.58, 0.4);
  if (h < 0.56) return seg(h, 0.12, 0.56, 0.36, 0.2);
  if (h < 0.6) return 0.34;
  if (h < 0.63) return 0.22;
  if (h < 0.8) return seg(h, 0.63, 0.8, 0.24, 0.36);
  return seg(h, 0.8, 0.88, 0.36, 0.1);
};

const rookProfile: Profile = (h) => {
  if (h < 0.08) return seg(h, 0, 0.08, 0.5, 0.48);
  if (h < 0.15) return seg(h, 0.08, 0.15, 0.48, 0.36);
  if (h < 0.72) return seg(h, 0.15, 0.72, 0.32, 0.27);
  if (h < 0.8) return seg(h, 0.72, 0.8, 0.27, 0.37);
  return 0.37;
};

const pawnProfile: Profile = (h) => {
  if (h < 0.08) return seg(h, 0, 0.08, 0.44, 0.42);
  if (h < 0.15) return seg(h, 0.08, 0.15, 0.42, 0.3);
  if (h < 0.5) return seg(h, 0.15, 0.5, 0.26, 0.14);
  if (h < 0.56) return 0.26;
  if (h < 0.6) return 0.15;
  return ball(h, 0.79, 0.2, 0.25);
};

/** Dots on a surface of revolution, density even across rings. */
function lathe(
  n: number,
  profile: Profile,
  height: number,
  at: [number, number],
  hMax = 1,
  crenellate = false,
): Pt[] {
  const rings = Math.max(8, Math.round(Math.sqrt(n) * 0.9));
  const radii: number[] = [];
  let sum = 0;
  for (let i = 0; i < rings; i++) {
    const r = Math.max(0.04, profile((i / (rings - 1)) * hMax));
    radii.push(r);
    sum += r;
  }
  const out: Pt[] = [];
  for (let i = 0; i < rings; i++) {
    const h = (i / (rings - 1)) * hMax;
    const count = Math.max(4, Math.round((radii[i] / sum) * n));
    for (let j = 0; j < count; j++) {
      const a = (TAU * (j + 0.5 * (i % 2))) / count;
      let y = h;
      // Rook battlements: four merlons; dots in the gaps drop to the rim.
      if (crenellate && h > 0.88 && Math.cos(4 * a) < -0.2) y = 0.88;
      out.push([at[0] + radii[i] * Math.cos(a), y * height, at[1] + radii[i] * Math.sin(a)]);
    }
  }
  return out;
}

/** The king's cross, above the lathe body. */
function cross(n: number, height: number, at: [number, number]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const q = i / n;
    const w = ((i * 0.6180339) % 1) - 0.5; // thickness, deterministic
    out.push(
      q < 0.55
        ? [at[0] + w * 0.05, lerp(0.88, 1.02, q / 0.55) * height, at[1]]
        : [at[0] + lerp(-0.14, 0.14, (q - 0.55) / 0.45), 0.96 * height, at[1] + w * 0.05],
    );
  }
  return out;
}

// Knight silhouette in the Staunton style, facing right (x), y up, height 1:
// back and mane, two ears, forehead, long nose, chin, throat notch, chest.
const KNIGHT: [number, number][] = [
  [-0.3, 0.16], [-0.32, 0.3], [-0.3, 0.46], [-0.25, 0.62], [-0.18, 0.76],
  [-0.1, 0.87], [-0.02, 0.95], [0.02, 1.0], [0.07, 0.93], [0.12, 0.96],
  [0.16, 0.88], [0.28, 0.8], [0.4, 0.68], [0.48, 0.56], [0.46, 0.5],
  [0.36, 0.47], [0.22, 0.52], [0.12, 0.46], [0.14, 0.36], [0.22, 0.26],
  [0.3, 0.16],
];

function insideKnight(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = KNIGHT.length - 1; i < KNIGHT.length; j = i++) {
    const [xi, yi] = KNIGHT[i];
    const [xj, yj] = KNIGHT[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A flat knight cut-out: a turned base, then the head-and-neck silhouette as
 * an evenly filled lattice plus a denser outline on both faces, so it reads
 * as a solid shape from the scene's tilted camera.
 */
function knight(n: number, height: number, at: [number, number], facing: number): Pt[] {
  const baseN = Math.round(n * 0.15);
  const outlineN = Math.round(n * 0.5);
  const fillN = n - baseN - outlineN;
  const local: [number, number, number][] = [];

  // outline, sampled by arc length, on two faces
  const edges: number[] = [];
  let perim = 0;
  for (let i = 0; i < KNIGHT.length; i++) {
    const a = KNIGHT[i];
    const b = KNIGHT[(i + 1) % KNIGHT.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    edges.push(len);
    perim += len;
  }
  const perFace = Math.floor(outlineN / 2);
  for (let face = 0; face < 2; face++) {
    for (let k = 0; k < perFace; k++) {
      let d = ((k + 0.5 * face) / perFace) * perim;
      let i = 0;
      while (d > edges[i] && i < edges.length - 1) d -= edges[i++];
      const a = KNIGHT[i];
      const b = KNIGHT[(i + 1) % KNIGHT.length];
      const t = d / edges[i];
      local.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), face ? 0.03 : -0.03]);
    }
  }

  // fill: a square lattice inside the silhouette, spacing sized to the budget
  let area = 0;
  for (let i = 0, j = KNIGHT.length - 1; i < KNIGHT.length; j = i++) {
    area += (KNIGHT[j][0] + KNIGHT[i][0]) * (KNIGHT[j][1] - KNIGHT[i][1]);
  }
  area = Math.abs(area) / 2;
  const step = Math.sqrt(area / fillN);
  for (let y = 0.16 + step / 2; y < 1 && local.length < outlineN + fillN; y += step) {
    for (let x = -0.33 + step / 2; x < 0.49; x += step) {
      if (insideKnight(x, y)) local.push([x, y, 0]);
    }
  }

  const out = lathe(baseN, (h) => seg(h, 0, 1, 0.48, 0.36), height * 0.16, at);
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  for (const [lx, ly, lz] of local) {
    const x = lx * height;
    const z = lz * height;
    out.push([at[0] + x * c - z * s, ly * height, at[1] + x * s + z * c]);
  }
  return out;
}

function board(lattice: number, borderN: number): Pt[] {
  const out: Pt[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 === 0) continue; // light squares stay empty
      const [cx, cz] = square(file, rank);
      for (let j = 0; j < lattice; j++) {
        for (let i = 0; i < lattice; i++) {
          out.push([cx + ((i + 0.5) / lattice - 0.5) * S, 0, cz + ((j + 0.5) / lattice - 0.5) * S]);
        }
      }
    }
  }
  // a fine frame around the board
  const half = 4 * S + 0.06;
  for (let i = 0; i < borderN; i++) {
    const q = (i / borderN) * 4;
    const side = Math.floor(q);
    const t = (q - side) * 2 - 1;
    const p: [number, number] =
      side === 0 ? [t * half, -half] : side === 1 ? [half, t * half] : side === 2 ? [-t * half, half] : [-half, -t * half];
    out.push([p[0], 0, p[1]]);
  }
  return out;
}

export function chessGeometry(count: number): Float32Array {
  const lattice = Math.max(4, Math.floor(Math.sqrt((count * 0.42) / 32)));
  const boardPts = board(lattice, Math.round(count * 0.05));
  // 3% headroom so per-ring rounding can't push the last piece past `count`.
  const rest = Math.max(0, count - boardPts.length) * 0.97;

  // Squares chosen so that, from the scene's camera angle (board turned
  // −0.62 rad), the four pieces sit side by side without overlapping:
  // rook, knight, king, pawn from left to right.
  const pts: Pt[] = [
    ...boardPts,
    ...lathe(Math.round(rest * 0.23), rookProfile, 1.5, square(0, 5), 1, true),
    // facing −0.62 cancels the board's turn, so the knight is seen side-on
    ...knight(Math.round(rest * 0.27), 2.1, square(3, 5), -0.62),
    ...lathe(Math.round(rest * 0.28), kingProfile, 2.4, square(5, 2), 0.88),
    ...cross(Math.round(rest * 0.04), 2.4, square(5, 2)),
    ...lathe(Math.round(rest * 0.18), pawnProfile, 1.15, square(7, 1)),
  ];

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = pts[i % pts.length];
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}
