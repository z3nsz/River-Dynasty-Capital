/**
 * One particle field, six mathematical states. Every state is a function of
 * the same per-particle parameters (aUV on a grid, aSeed random), so moving
 * between states is a true per-particle interpolation, not a crossfade:
 *
 *   0  three waves      — the logo, as travelling sinusoids
 *   1  Lorenz attractor — particles flowing along an RK4-integrated orbit
 *   2  valuation        — two-stage DCF value over growth × discount rate
 *   3  price & EMAs     — the waves resolving into a price path and its averages
 *   4  vol surface      — implied vol over log-moneyness × maturity, skew breathing
 *   5  Möbius strip     — three strips, closing the loop back to the three waves
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

attribute vec2 aUV;
attribute float aSeed;

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

// 0 — three parallel waves, as in the mark.
vec3 waves(vec2 uv, float t) {
  float b = bandOf(uv), vb = inBand(uv);
  float x = (uv.x - 0.5) * 9.5;
  float k = TAU * 1.5 / 9.5;
  float y = (1.0 - b) * 0.62
          + 0.34 * sin(k * x - t * 0.55 + b * 0.16)
          + 0.045 * sin(2.6 * k * x + t * 0.8 + b);
  y += (vb - 0.5) * 0.05;
  float z = (vb - 0.5) * 0.5 + 0.12 * sin(0.7 * k * x + t * 0.4 + b * 1.3);
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

// 2 — intrinsic value surface: ln V(g, r), five explicit years + Gordon terminal.
float dcf(float g, float r) {
  float fcf = 1.0, d = 1.0, pv = 0.0;
  for (int i = 0; i < 5; i++) { fcf *= 1.0 + g; d *= 1.0 + r; pv += fcf / d; }
  const float gt = 0.025;
  return pv + fcf * (1.0 + gt) / (r - gt) / d;
}
vec3 valuation(vec2 uv, float t) {
  float g = uv.x * 0.20;            // 0–20% growth
  float r = 0.07 + uv.y * 0.06;     // 7–13% discount rate
  float v = log(dcf(g, r));
  vec3 p = vec3((uv.x - 0.5) * 5.6, (v - 3.0) * 1.2, (uv.y - 0.5) * 4.4);
  p.y += 0.035 * sin(uv.x * 16.0 - t * 0.9);
  p = rotY(p, 0.6 + 0.25 * sin(t * 0.06));
  return rotX(p, 0.48);
}

// 3 — price path (band 0) and two lagging, smoother averages (bands 1, 2).
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

// 4 — implied volatility surface (mirrors impliedVol() in lib/site/math.ts).
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
  float st = 0.5 + 0.5 * sin(t * 0.22);
  vec3 p = vec3(k * 7.0, (iv(k, T, st) - 0.3) * 7.0, (uv.y - 0.5) * 4.6);
  p = rotY(p, -0.6 + 0.2 * sin(t * 0.05));
  return rotX(p, 0.42);
}

// 5 — Möbius strip carrying three strips: the three waves, closed into one surface.
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
  if (i < 2.5) return valuation(uv, t);
  if (i < 3.5) return price(uv, t);
  if (i < 4.5) return volSurface(uv, t);
  return mobius(uv, t);
}

void main() {
  vec3 a = stateAt(uA, aUV, aSeed, uTime);
  vec3 b = uB == uA ? a : stateAt(uB, aUV, aSeed, uTime);

  // Staggered departure so the field flows between states rather than blending.
  float m = smoothstep(0.0, 1.0, clamp(uMix * 1.45 - aSeed * 0.45, 0.0, 1.0));
  vec3 pos = mix(a, b, m);
  float lift = sin(m * 3.14159265);
  pos += (vec3(hash(aSeed * 17.0), hash(aSeed * 29.0), hash(aSeed * 43.0)) - 0.5) * lift * 0.32;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.55 + 0.9 * hash(aSeed * 7.0)) / -mv.z;

  // Logo gradient (blue → teal) across the field, the top band lifted toward white.
  float band = bandOf(aUV);
  vec3 base = mix(vec3(0.18, 0.50, 0.72), vec3(0.09, 0.69, 0.63), aUV.x);
  vColor = mix(base, vec3(0.90, 0.94, 0.93), 0.22 + 0.16 * (2.0 - band) / 2.0);
  vAlpha = uOpacity * (0.55 + 0.45 * hash(aSeed * 3.0));
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.5, 0.12, d) * vAlpha);
}
`;
