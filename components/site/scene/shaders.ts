/**
 * One particle field, six mathematical states. Every state is a function of
 * the same per-particle parameters (aUV on a grid, aSeed random), so moving
 * between states is a true per-particle interpolation, not a crossfade:
 *
 *   0  three waves      — the logo, as travelling sinusoids
 *   1  Lorenz attractor — particles flowing along an RK4-integrated orbit
 *   2  strategy         — a flat chess emblem: king, knight and rook on diamonds
 *   3  fundamentals     — bar chart, pie chart, histogram and area chart, in dots
 *   4  price & EMAs     — the waves resolving into a price path and its averages
 *   5  vol surface      — implied vol over log-moneyness × maturity, skew breathing
 *   6  Möbius strip     — three strips, closing the loop back to the three waves
 *
 * All positions are computed in the vertex shader; the CPU only sets uniforms.
 */

export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uA;
uniform float uB;
uniform float uMix;
uniform sampler2D uLorenz;
uniform float uLorenzN;
uniform float uSize;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uGx;
uniform float uGy;
uniform float uAspect;   // viewport width / height
// Recent cursor path: xy = NDC position, z = age in seconds, w = impulse (0–1).
#define TRAIL 48
uniform vec4 uTrail[TRAIL];

attribute vec2 aUV;
attribute float aSeed;
attribute vec3 aChess;

varying vec3 vColor;
varying float vAlpha;

const float TAU = 6.28318530718;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
vec3 rotX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// Which of the three bands (waves / strips / lines) a particle belongs to.
float bandOf(vec2 uv) { return min(floor(uv.y * 3.0), 2.0); }
float inBand(vec2 uv) { return uv.y * 3.0 - bandOf(uv); }

// Grid position of this particle (column, row).
float colOf(vec2 uv) { return floor(uv.x * (uGx - 1.0) + 0.5); }
float rowOf(vec2 uv) { return floor(uv.y * uGy); }

// 0 — three parallel waves, as in the mark: tall, thick, made of spaced dots.
vec3 waves(vec2 uv, float t) {
  float b = bandOf(uv), vb = inBand(uv);
  float x = (uv.x - 0.5) * 9.5;
  float k = TAU * 1.5 / 9.5;
  float y = (1.0 - b) * 0.74
          + 0.48 * sin(k * x - t * 0.55 + b * 0.16)
          + 0.05 * sin(2.6 * k * x + t * 0.8 + b);
  y += (vb - 0.5) * 0.22;
  float z = (vb - 0.5) * 0.3 + 0.12 * sin(0.7 * k * x + t * 0.4 + b * 1.3);
  return vec3(x, y, z);
}

// 1 — Lorenz (σ=10, ρ=28, β=8/3), sampled from a precomputed orbit texture.
vec3 lorenz(float seed, float t) {
  float ph = fract(seed + t * 0.004);
  float idx = ph * (uLorenzN - 1.0);
  float i0 = floor(idx);
  vec3 p0 = texture2D(uLorenz, vec2((i0 + 0.5) / uLorenzN, 0.5)).xyz;
  vec3 p1 = texture2D(uLorenz, vec2((min(i0 + 1.0, uLorenzN - 1.0) + 0.5) / uLorenzN, 0.5)).xyz;
  vec3 p = mix(p0, p1, idx - i0);
  vec3 q = vec3(p.x, p.z - 25.0, p.y) * 0.088;
  q += (vec3(hash(seed * 91.7), hash(seed * 37.3), hash(seed * 13.1)) - 0.5) * 0.045;
  return rotX(rotY(q, t * 0.07), 0.18);
}

// 2 — strategy: a flat chess emblem (king in front, knight and rook behind,
// four dark diamonds). Built once on the CPU (chessGeometry.ts) as aChess:
// xy position; z = size factor (+10 on board dots). The whole emblem, board
// included, bounces slowly as one, so it seems to float, with a small wave
// rolling through it left to right.
vec3 chess(float t) {
  vec3 p = vec3(aChess.xy, 0.0);
  float hop = abs(sin(t * 0.75));            // one bounce every ~4 s
  p.y += 0.16 * hop * hop * (3.0 - 2.0 * hop);
  p.y += 0.035 * sin(t * 1.1 - p.x * 1.2);   // a small wave rolling through
  return p;
}

// Point j of a column of n dots, laid on a lattice cols wide.
// Returns (x, y) as fractions 0–1 of the column's width and height.
vec2 lattice(float j, float n, float cols) {
  float rows = max(2.0, ceil(n / cols));
  return vec2(mod(j, cols) / max(1.0, cols - 1.0), floor(j / cols) / (rows - 1.0));
}

// 3 — fundamentals: four small charts as one 2×2 composition, each a solid
// field of dots. Top left a compounding bar chart, top right a pie chart
// (golden-angle fill, slices exploded, the largest one breathing out),
// bottom left a histogram (Gaussian bins, the mean drifting), bottom right
// an area chart (filled to a rising curve, densest along its edge).
vec3 fundamentals(vec2 uv, float t) {
  float N = uGx * uGy;
  float idx = rowOf(uv) * uGx + colOf(uv);
  float q = idx / N;
  vec3 p;
  if (q < 0.34) {
    const float NB = 8.0;
    float bar = mod(idx, NB);
    vec2 g = lattice(floor(idx / NB), N * 0.34 / NB, 5.0);
    float f = bar / (NB - 1.0);
    float h = (0.25 + 1.15 * pow(f, 1.3)) * (0.93 + 0.07 * sin(t * 0.8 - bar * 0.6));
    p = vec3(-2.13 + bar * 0.27 + g.x * 0.17, 0.2 + g.y * h, 0.0);
  } else if (q < 0.6) {
    float n = N * 0.26;
    float li = idx - N * 0.34;
    float r = 0.68 * sqrt((li + 0.5) / n);
    float fr = fract(li * 0.38196601);            // golden-angle turn, as a fraction
    float lo = fr < 0.38 ? 0.0 : fr < 0.64 ? 0.38 : fr < 0.85 ? 0.64 : 0.85;
    float hi = fr < 0.38 ? 0.38 : fr < 0.64 ? 0.64 : fr < 0.85 ? 0.85 : 1.0;
    float mid = 0.5 * (lo + hi);
    fr = mid + (fr - mid) * (1.0 - 0.035 / (hi - lo));   // thin gap between slices
    float spin = t * 0.08;
    float a = TAU * fr + spin;
    float am = TAU * mid + spin;
    float pop = lo < 0.01 ? 0.07 + 0.06 * (0.5 + 0.5 * sin(t * 0.9)) : 0.03;
    p = vec3(1.25 + r * cos(a) + pop * cos(am), 0.9 + r * sin(a) + pop * sin(am), 0.0);
  } else if (q < 0.8) {
    const float NH = 15.0;
    float li = idx - N * 0.6;
    float bin = mod(li, NH);
    vec2 g = lattice(floor(li / NH), N * 0.2 / NH, 3.0);
    float z = (bin - 7.0) / 3.0 - 0.45 * sin(t * 0.25);
    float h = 0.08 + 1.2 * exp(-0.5 * z * z) * (0.93 + 0.07 * sin(t * 1.1 + bin));
    p = vec3(-2.25 + bin * 0.14 + g.x * 0.095, -1.6 + g.y * h, 0.0);
  } else {
    const float AC = 40.0;
    float li = idx - N * 0.8;
    float c = mod(li, AC);
    float rows = max(1.0, floor(N * 0.2 / AC) - 1.0);
    float x = c / (AC - 1.0);
    float y = 0.35 + 0.55 * x + 0.16 * sin(x * 7.0 + t * 0.5) + 0.07 * sin(x * 15.0 - t * 0.8);
    float v = pow(min(floor(li / AC) / rows, 1.0), 0.7);
    p = vec3(0.2 + x * 2.1, -1.6 + v * y, 0.0);
  }
  p *= 1.25;
  p.z += (hash(aSeed * 17.0) - 0.5) * 0.06;
  p = rotY(p, -0.22 + 0.06 * sin(t * 0.07));
  return rotX(p, 0.08);
}

// 4 — price path (band 0) and two lagging, smoother averages (bands 1, 2).
vec3 price(vec2 uv, float t) {
  float b = bandOf(uv), vb = inBand(uv);
  float x = (uv.x - 0.5) * 9.5;
  float s = x * 0.75 + t * 0.32;
  float s2 = s - b * 0.38;
  float y = 0.55 * sin(0.9 * s2) + 0.24 * sin(2.3 * s2 + 1.0) + x * 0.06;
  if (b < 0.5) y += 0.12 * sin(5.1 * s + 2.0) + 0.05 * sin(11.7 * s + 0.5);
  else if (b < 1.5) y += 0.05 * sin(5.1 * s2 + 2.0);
  y += (vb - 0.5) * 0.03;
  return vec3(x, y, (vb - 0.5) * 0.3);
}

// 5 — implied volatility surface (mirrors impliedVol() in lib/site/math.ts).
float iv(float k, float T, float st) {
  T = max(T, 0.02);
  float atm = 0.16 + 0.05 * st + (0.06 * st + 0.02) * exp(-2.2 * T);
  float sk = -(0.12 + 0.1 * st) / sqrt(T + 0.08);
  float sm = (0.22 + 0.08 * st) / sqrt(T + 0.08);
  return max(0.04, atm + sk * k * 0.5 + sm * k * k);
}
vec3 volSurface(vec2 uv, float t) {
  float k = (uv.x - 0.5) * 0.8;     // log-moneyness ±0.4
  float T = 0.05 + uv.y * 1.95;     // 0.05–2 years
  float st = 0.5 + 0.5 * sin(t * 0.35);
  // Vol shocks: one wave travelling down the term structure, one across strikes.
  float ripple = (0.55 * sin(uv.y * 8.0 - t * 1.2 + k * 5.0)
                + 0.2 * sin(k * 14.0 + t * 0.9)) * (0.7 + 0.3 * sin(t * 0.3));
  vec3 p = vec3(k * 7.0, (iv(k, T, st) - 0.3) * 11.0 + ripple, (uv.y - 0.5) * 4.6) * 0.7;
  p = rotY(p, -0.75 + 0.2 * sin(t * 0.05));
  return rotX(p, 0.38);
}

// 6 — Möbius strip carrying three strips: the three waves, closed into one surface.
vec3 mobius(vec2 uv, float t) {
  float b = bandOf(uv), vb = inBand(uv);
  float u = uv.x * TAU;
  float v = ((b + 0.2 + vb * 0.6) / 3.0) * 2.0 - 1.0;
  float w = 0.05 * sin(3.0 * u - t * 0.8 + b);
  float h = v * 0.5 + w;
  float r = 1.0 + h * cos(u * 0.5);
  vec3 p = vec3(r * cos(u), r * sin(u), h * sin(u * 0.5)) * 1.9;
  return rotY(rotX(p, 1.05), t * 0.07);
}

vec3 stateAt(float i, vec2 uv, float seed, float t) {
  if (i < 0.5) return waves(uv, t);
  if (i < 1.5) return lorenz(seed, t);
  if (i < 2.5) return chess(t);
  if (i < 3.5) return fundamentals(uv, t);
  if (i < 4.5) return price(uv, t);
  if (i < 5.5) return volSurface(uv, t);
  return mobius(uv, t);
}

// Per-state look. The waves are a sparser lattice of larger, even dots
// (every 2nd column, every 3rd row within each wave); other states use all
// particles at varied sizes.
float lookVis(float i, vec2 uv) {
  if (i > 0.5) return 1.0;
  float rowInWave = floor(inBand(uv) * uGy / 3.0);
  return (mod(colOf(uv), 2.0) < 0.5 && mod(rowInWave, 3.0) < 0.5) ? 1.0 : 0.0;
}
float lookSize(float i, float seed) {
  if (i < 0.5) return 2.1;
  float s = 0.55 + 0.9 * hash(seed * 7.0);
  // chess: the same dots as every other scene, a touch smaller in the
  // tighter band along each edge (a size factor under 0.7 marks those)
  if (i > 1.5 && i < 2.5 && mod(aChess.z, 10.0) < 0.7) s *= 0.72;
  return s;
}
// Only the opening waves and the closing Möbius strip react to the cursor.
float lookInteract(float i) {
  return (i < 0.5 || i > 5.5) ? 1.0 : 0.0;
}

void main() {
  vec3 a = stateAt(uA, aUV, aSeed, uTime);
  vec3 b = uB == uA ? a : stateAt(uB, aUV, aSeed, uTime);

  // Staggered departure so the field flows between states rather than blending.
  // Per-dot morph. A light stagger (each dot starts within the first 13% of
  // the segment) keeps it organic; the half-linear ease has a non-zero slope
  // at both ends, so dots start moving the instant scrolling starts and
  // arrive without a snap.
  float mx = clamp(uMix * 1.15 - aSeed * 0.15, 0.0, 1.0);
  float m = mix(mx, mx * mx * (3.0 - 2.0 * mx), 0.5);
  vec3 pos = mix(a, b, m);
  float lift = sin(m * 3.14159265);
  pos += (vec3(hash(aSeed * 17.0), hash(aSeed * 29.0), hash(aSeed * 43.0)) - 0.5) * lift * 0.32;

  // Cursor: every recent point on the cursor's path is an impulse that pushes
  // nearby dots outward. Each dot then returns like a damped spring: a quick
  // push, a slow ~2.5s settle with one soft overshoot. Mostly radial, with a
  // little per-dot variation in angle and strength. Screen-space, so depth
  // and perspective can't offset it from the cursor.
  float inter = mix(lookInteract(uA), lookInteract(uB), m);
  if (inter > 0.001) {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    vec2 sp = clip.xy / clip.w;
    vec2 push = vec2(0.0);
    for (int j = 0; j < TRAIL; j++) {
      vec4 tp = uTrail[j];
      if (tp.z > 3.0) continue;
      vec2 d = (sp - tp.xy) * vec2(uAspect, 1.0);
      float r2 = dot(d, d);
      if (r2 > 0.16) continue;
      float age = tp.z;
      float spring = (1.0 - exp(-age * 14.0)) * exp(-age * 1.25) * cos(age * 2.0);
      push += normalize(d + vec2(1e-5)) * exp(-r2 / 0.028) * spring * tp.w;
    }
    float len = length(push);
    if (len > 1.0) push /= len;
    float ang = (hash(aSeed * 61.0) - 0.5) * 0.55;
    float ca = cos(ang), sa = sin(ang);
    push = vec2(ca * push.x - sa * push.y, sa * push.x + ca * push.y) * (0.8 + 0.4 * hash(aSeed * 73.0));
    pos.xy += push * 0.4 * inter;
    pos.z += length(push) * (hash(aSeed * 89.0) - 0.5) * 0.35 * inter;
  }

  float vis = mix(lookVis(uA, aUV), lookVis(uB, aUV), m);
  float size = mix(lookSize(uA, aSeed), lookSize(uB, aSeed), m);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vis < 0.01 ? 0.0 : uSize * uPixelRatio * size / -mv.z;

  // Logo gradient (blue → teal) across the field, the top band lifted toward white.
  float band = bandOf(aUV);
  vec3 base = mix(vec3(0.18, 0.50, 0.72), vec3(0.09, 0.69, 0.63), aUV.x);
  vColor = mix(base, vec3(0.90, 0.94, 0.93), 0.22 + 0.16 * (2.0 - band) / 2.0);
  vAlpha = uOpacity * vis * (0.55 + 0.45 * hash(aSeed * 3.0));
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // Solid disc with a thin anti-aliased rim, so dots read crisp, not as glows.
  gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.34, 0.5, d)) * vAlpha);
}
`;
