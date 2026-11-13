"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { vertexShader, fragmentShader } from "./scene/shaders";
import { chessGeometry } from "./scene/chessGeometry";
import { lorenzTrajectory } from "@/lib/site/math";
import { StaticWaves } from "./StaticWaves";

/**
 * The persistent background: one fixed WebGL canvas behind the whole page.
 *
 * Why it can't "stop after the About section": the canvas is position:fixed and
 * outside the scroll flow, nothing is pinned, and scroll progress is computed
 * every frame from section anchors that are re-measured whenever the document
 * resizes (fonts, images, viewport). Sections only declare which state they
 * belong to via data-scene; they never own the animation.
 */

const STATES = 7;
// Per-state placement, desktop. Index = scene state.
// waves, Lorenz, chess, bars, price, vol surface, Möbius
// Price and vol surface sit low, as a horizon under the heading and the
// chart, so the live chart and the particle scene never cross.
const OFFSET_X = [0, 1.9, 2.4, 2.2, -1.2, -3.4, 0];
const OFFSET_Y = [-1.6, 0, 0.0, 0, -2.4, -1.8, 0.55];
// Below 900px the text is centred over the scene, so the chess set moves up
// above the Strategy headline instead of sitting behind it.
const OFFSET_Y_NARROW = [-1.6, 0, 1.95, -2.3, -3.25, -3.05, 0.55];
const OPACITY = [1, 0.95, 0.95, 0.95, 0.4, 0.6, 1];
const TRAIL = 48; // must match #define TRAIL in the shader
const OPACITY_SMALL = [0.85, 0.6, 0.55, 0.7, 0.28, 0.28, 0.85];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function sample(arr: number[], p: number) {
  const i = Math.min(Math.floor(p), arr.length - 1);
  const j = Math.min(i + 1, arr.length - 1);
  return lerp(arr[i], arr[j], p - i);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MathScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!hasWebGL()) {
      setFallback(true);
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 900;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    // --- particles: a grid of (u, v) params, three bands of rows ----------
    const gx = small || lowPower ? 132 : 192;
    const gy = small || lowPower ? 24 : 36;
    const count = gx * gy;
    const uv = new Float32Array(count * 2);
    const seed = new Float32Array(count);
    const pos = new Float32Array(count * 3); // unused by the shader; bounds only
    let s = 1234567;
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const n = j * gx + i;
        uv[n * 2] = i / (gx - 1);
        uv[n * 2 + 1] = (j + 0.5) / gy;
        s = (s * 16807) % 2147483647;
        seed[n] = s / 2147483647;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aUV", new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute("aChess", new THREE.BufferAttribute(chessGeometry(count), 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    // Lorenz orbit → float texture, sampled in the vertex shader.
    const LN = 4096;
    const orbit = lorenzTrajectory(LN, 0.01);
    const tex = new Float32Array(LN * 4);
    for (let i = 0; i < LN; i++) {
      tex[i * 4] = orbit[i * 3];
      tex[i * 4 + 1] = orbit[i * 3 + 1];
      tex[i * 4 + 2] = orbit[i * 3 + 2];
      tex[i * 4 + 3] = 1;
    }
    const lorenzTex = new THREE.DataTexture(tex, LN, 1, THREE.RGBAFormat, THREE.FloatType);
    lorenzTex.minFilter = THREE.NearestFilter;
    lorenzTex.magFilter = THREE.NearestFilter;
    lorenzTex.needsUpdate = true;

    const uniforms = {
      uTime: { value: 0 },
      uA: { value: 0 },
      uB: { value: 0 },
      uMix: { value: 0 },
      uLorenz: { value: lorenzTex },
      uLorenzN: { value: LN },
      uSize: { value: small ? 30 : 34 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uOpacity: { value: 1 },
      uGx: { value: gx },
      uGy: { value: gy },
      uAspect: { value: 1 },
      uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4(9, 9, 99, 0)) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // --- scroll anchors: the scroll position at which each state is centred --
    let anchors: number[] = [];
    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
      const vh = window.innerHeight;
      const max = Math.max(0, document.documentElement.scrollHeight - vh);
      const byState: number[] = [];
      for (const el of els) {
        const idx = Number(el.dataset.scene);
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        byState[idx] = Math.min(max, Math.max(0, top + r.height / 2 - vh / 2));
      }
      anchors = [];
      for (let i = 0; i < STATES; i++) {
        const prev = anchors[i - 1] ?? 0;
        anchors.push(Math.max(prev, byState[i] ?? prev));
      }
    };
    // The scroll position the scene follows. GSAP ScrollTrigger scrubs it
    // across the whole page (start 0 → end max, no pinning, so no added
    // spacing or empty ranges): it tracks the real scroll with a short eased
    // catch-up, so motion is tied to scrolling yet never steps.
    gsap.registerPlugin(ScrollTrigger);
    const scrub = { y: window.scrollY };
    const scrubTween = gsap.fromTo(
      scrub,
      { y: 0 },
      {
        y: () => ScrollTrigger.maxScroll(window),
        ease: "none",
        scrollTrigger: {
          start: 0,
          end: "max",
          scrub: reduce ? true : 0.6,
          invalidateOnRefresh: true,
          // Section snapping. Scrolling stays free; once the user stops, the
          // page glides to a section's alignment (the same anchors the scene
          // morphs between, so each scene finishes forming exactly as its
          // section settles). It snaps from where the page actually stopped
          // (inertia off: native momentum on touch has already played out,
          // and a fast flick can't be extrapolated past the page), with a
          // bias toward the scroll direction: 30% of the way into the next
          // section is enough to settle there. Off for reduced motion.
          snap: reduce
            ? undefined
            : {
                snapTo: (value: number, self?: ScrollTrigger) => {
                  const max = ScrollTrigger.maxScroll(window);
                  if (anchors.length < 2 || max < 1) return value;
                  const y = value * max;
                  let i = 0;
                  while (i < anchors.length - 2 && y > anchors[i + 1]) i++;
                  const a = anchors[i];
                  const b = anchors[i + 1];
                  if (b - a < 1) return b / max;
                  const f = (y - a) / (b - a);
                  const down = (self?.direction ?? 1) > 0;
                  const toNext = down ? f > 0.3 : f > 0.7;
                  return (toNext ? b : a) / max;
                },
                inertia: false,
                duration: { min: 0.3, max: 0.75 },
                delay: 0.08,
                ease: "power2.inOut",
              },
        },
      },
    );
    ScrollTrigger.addEventListener("refresh", measure);

    const target = () => {
      const y = reduce ? window.scrollY : scrub.y;
      if (!anchors.length || y <= anchors[0]) return 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y < anchors[i + 1]) {
          const span = anchors[i + 1] - anchors[i];
          // Linear in scroll: each section's composition sits exactly at its
          // anchor, and every pixel scrolled away from it moves the dots
          // toward the next formation. No hold, no delayed start.
          return i + (span < 1 ? 1 : (y - anchors[i]) / span);
        }
      }
      return anchors.length - 1;
    };

    // --- sizing -----------------------------------------------------------
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the composition similar on narrow screens by pulling back.
      camera.position.z = w < 640 ? 13 : w < 900 ? 11 : 9;
      camera.updateProjectionMatrix();
      measure();
    };
    resize();
    const ro = new ResizeObserver(() => {
      // Page height changed: re-measure anchors and the scrub's scroll range.
      measure();
      ScrollTrigger.refresh();
      if (reduce) requestRender();
    });
    ro.observe(document.body);
    window.addEventListener("resize", resize);
    document.fonts?.ready.then(measure).catch(() => {});

    // --- pointer: a slight change of perspective, never a takeover --------
    const pointer = { x: 0, y: 0 };

    // The cursor's recent path, sampled by distance travelled. Each sample is
    // an impulse whose strength is how far the cursor moved to make it, so a
    // resting cursor adds nothing and a fast swipe hits harder.
    const trail: { x: number; y: number; born: number; w: number }[] = [];
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;
    const STEP = 0.022; // NDC distance between samples

    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      const x = pointer.x;
      const y = -pointer.y;
      if (!hasLast) {
        lastX = x;
        lastY = y;
        hasLast = true;
        return;
      }
      const dist = Math.hypot((x - lastX) * camera.aspect, y - lastY);
      if (dist < STEP) return;
      const now = performance.now();
      const n = Math.min(6, Math.floor(dist / STEP));
      for (let i = 1; i <= n; i++) {
        trail.push({
          x: lastX + ((x - lastX) * i) / n,
          y: lastY + ((y - lastY) * i) / n,
          born: now,
          w: Math.min(1, dist / n / 0.03),
        });
      }
      while (trail.length > TRAIL) trail.shift();
      lastX = x;
      lastY = y;
    };
    if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    // --- frame loop ---------------------------------------------------------
    let progress = target();
    let time = 4; // start mid-motion so the first frame is already composed
    let last = performance.now();
    let raf = 0;
    let lost = false;

    const apply = (dt: number) => {
      // Smoothing comes from the scrub alone; a second filter here would lag.
      progress = target();
      const a = Math.min(Math.floor(progress), STATES - 1);
      uniforms.uA.value = a;
      uniforms.uB.value = Math.min(a + 1, STATES - 1);
      uniforms.uMix.value = progress - a;
      uniforms.uTime.value = time;

      const narrow = window.innerWidth < 900;
      // Narrow layouts share the phone composition. OFFSET_Y_NARROW is tuned
      // for the phone camera (z = 13); scaling by the actual camera distance
      // keeps the same on-screen placement on tablets (z = 11).
      points.scale.setScalar(narrow ? 0.72 : 1);
      points.position.x = narrow ? 0 : sample(OFFSET_X, progress);
      points.position.y = narrow
        ? sample(OFFSET_Y_NARROW, progress) * (camera.position.z / 13)
        : sample(OFFSET_Y, progress);
      uniforms.uOpacity.value = sample(narrow ? OPACITY_SMALL : OPACITY, progress);

      const k = reduce ? 1 : 1 - Math.exp(-dt * 2.5);
      camera.position.x = lerp(camera.position.x, pointer.x * 0.55, k);
      camera.position.y = lerp(camera.position.y, -pointer.y * 0.35, k);
      camera.lookAt(0, 0, 0);

      if (!reduce) {
        uniforms.uAspect.value = camera.aspect;
        const now = performance.now();
        const slots = uniforms.uTrail.value;
        for (let i = 0; i < TRAIL; i++) {
          const p = trail[i];
          if (p) slots[i].set(p.x, p.y, (now - p.born) / 1000, p.w);
          else slots[i].set(9, 9, 99, 0);
        }
      }

      renderer.render(scene, camera);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      apply(dt);
      raf = requestAnimationFrame(frame);
    };

    let pending = false;
    function requestRender() {
      if (pending || lost) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        apply(0);
      });
    }

    if (reduce) {
      window.addEventListener("scroll", requestRender, { passive: true });
      requestRender();
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ScrollTrigger.removeEventListener("refresh", measure);
      scrubTween.scrollTrigger?.kill();
      scrubTween.kill();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", requestRender);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      geometry.dispose();
      material.dispose();
      lorenzTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="rdc-scene" aria-hidden="true">
      {fallback && <StaticWaves />}
    </div>
  );
}
