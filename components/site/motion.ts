/**
 * Small motion utility for the public site. No dependencies, so it stays
 * out of the lazy three.js/GSAP chunk and costs almost nothing up front.
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
