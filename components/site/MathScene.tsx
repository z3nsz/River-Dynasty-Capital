"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./scene/shaders";
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

const STATES = 6;
// Per-state placement, desktop. Index = scene state.
const OFFSET_X = [0, 1.9, -2.6, -2.9, -3.1, 0];
const OFFSET_Y = [-1.6, 0, -0.35, -1.35, -1.55, 0.55];
const OPACITY = [1, 0.95, 0.6, 0.4, 0.6, 1];
const OPACITY_SMALL = [0.85, 0.6, 0.28, 0.28, 0.28, 0.85];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
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
      uMouse: { value: new THREE.Vector2(9, 9) },
      uAspect: { value: 1 },
      uMouseAmt: { value: 0 },
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
    const target = () => {
      const y = window.scrollY;
      if (!anchors.length || y <= anchors[0]) return 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y < anchors[i + 1]) {
          const span = anchors[i + 1] - anchors[i];
          const f = span < 1 ? 1 : (y - anchors[i]) / span;
          return i + smoothstep(0.18, 0.82, f);
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
      measure();
      if (reduce) requestRender();
    });
    ro.observe(document.body);
    window.addEventListener("resize", resize);
    document.fonts?.ready.then(measure).catch(() => {});

    // --- pointer: a slight change of perspective, never a takeover --------
    const pointer = { x: 0, y: 0, moved: -1e9, seen: false };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.moved = performance.now();
      pointer.seen = true;
    };
    const mouseNdc = new THREE.Vector2(9, 9);
    const mouseGoal = new THREE.Vector2();
    if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    // --- frame loop ---------------------------------------------------------
    let progress = target();
    let time = 4; // start mid-motion so the first frame is already composed
    let last = performance.now();
    let raf = 0;
    let lost = false;

    const apply = (dt: number) => {
      const goal = target();
      progress = reduce ? goal : lerp(progress, goal, 1 - Math.exp(-dt * 3.2));
      const a = Math.min(Math.floor(progress), STATES - 1);
      uniforms.uA.value = a;
      uniforms.uB.value = Math.min(a + 1, STATES - 1);
      uniforms.uMix.value = progress - a;
      uniforms.uTime.value = time;

      const narrow = window.innerWidth < 900;
      points.scale.setScalar(window.innerWidth < 640 ? 0.72 : 1);
      points.position.x = narrow ? 0 : sample(OFFSET_X, progress);
      points.position.y = sample(OFFSET_Y, progress);
      uniforms.uOpacity.value = sample(narrow ? OPACITY_SMALL : OPACITY, progress);

      const k = reduce ? 1 : 1 - Math.exp(-dt * 2.5);
      camera.position.x = lerp(camera.position.x, pointer.x * 0.55, k);
      camera.position.y = lerp(camera.position.y, -pointer.y * 0.35, k);
      camera.lookAt(0, 0, 0);

      if (pointer.seen && !reduce) {
        // Follow the cursor with a little lag, so the disturbance trails it.
        mouseGoal.set(pointer.x, -pointer.y);
        if (mouseNdc.x > 8) mouseNdc.copy(mouseGoal);
        else mouseNdc.lerp(mouseGoal, 1 - Math.exp(-dt * 10));
        uniforms.uMouse.value.copy(mouseNdc);
        uniforms.uAspect.value = camera.aspect;
        // Strong while moving, healing over ~1s once the cursor rests.
        const sinceMove = (performance.now() - pointer.moved) / 1000;
        const goalAmt = sinceMove < 0.15 ? 1 : 0;
        const rate = goalAmt > uniforms.uMouseAmt.value ? 6 : 1.6;
        uniforms.uMouseAmt.value = lerp(uniforms.uMouseAmt.value, goalAmt, 1 - Math.exp(-dt * rate));
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
