/**
 * Small motion utilities for the public site. No dependencies, so they stay
 * out of the lazy three.js/GSAP chunk and cost almost nothing up front.
 */

const GLYPHS = "0123456789·:/+−×<>";

/**
 * Mono labels resolve like a readout: characters settle left to right out of
 * shuffling digits. The element's text is restored exactly when it finishes
 * (or when cancelled), so React's own text stays untouched.
 */
export function scrambleText(el: HTMLElement, ms = 650): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const final = el.dataset.text ?? el.textContent ?? "";
  if (!final.trim()) return () => {};
  el.dataset.text = final;
  const t0 = performance.now();
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    if (p >= 1) {
      el.textContent = final;
      return;
    }
    if (now - last > 38) {
      last = now;
      const settled = Math.floor(p * final.length);
      let out = final.slice(0, settled);
      for (let i = settled; i < final.length; i++) {
        const ch = final[i];
        out += ch === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    el.textContent = final;
  };
}

/**
 * Magnetic: within `radius` px of the element's centre it leans toward the
 * cursor, and springs back when the cursor leaves. Fine pointers only. The
 * loop runs only while the element is displaced.
 */
export function magnetic(el: HTMLElement, radius = 90, pull = 0.32): () => void {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(pointer: fine)").matches
  ) {
    return () => {};
  }
  let tx = 0, ty = 0; // target offset
  let x = 0, y = 0, vx = 0, vy = 0;
  let raf = 0;
  let last = 0;

  const step = (now: number) => {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    // critically-damped-ish spring
    vx += ((tx - x) * 190 - vx * 22) * dt;
    vy += ((ty - y) * 190 - vy * 22) * dt;
    x += vx * dt;
    y += vy * dt;
    const rest = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) < 0.05;
    if (rest && tx === 0 && ty === 0) {
      x = y = vx = vy = 0;
      el.style.transform = "";
      raf = 0;
      return;
    }
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    raf = requestAnimationFrame(step);
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    // measure from the resting position, not the displaced one
    const cx = r.left + r.width / 2 - x;
    const cy = r.top + r.height / 2 - y;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const reach = radius + Math.max(r.width, r.height) / 2;
    if (Math.hypot(dx, dy) < reach) {
      tx = dx * pull;
      ty = dy * pull;
      wake();
    } else if (tx !== 0 || ty !== 0) {
      tx = ty = 0;
      wake();
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    window.removeEventListener("pointermove", onMove);
    cancelAnimationFrame(raf);
    el.style.transform = "";
  };
}
