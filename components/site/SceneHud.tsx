"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToAnchor } from "./scrollTo";

/**
 * Orientation for the scroll journey, kept quiet:
 *  - a rail of ticks on the right edge, one per scene, the current one lit;
 *    hover names it, click glides there (desktop);
 *  - a figure caption, bottom right, naming the mathematics on screen, the
 *    way a research paper labels its plates (desktop);
 *  - a hairline under the nav that fills with overall progress, and the
 *    current section's nav link marked (via data attributes on <html>).
 */

const SCENES = [
  { label: "Research. Trade. Invest.", section: "top", fig: "Travelling waves", math: "y = A sin(kx − ωt)" },
  { label: "The Firm", section: "firm", fig: "Lorenz attractor", math: "σ 10 · ρ 28 · β 8/3" },
  { label: "Strategy", section: "strategy", fig: "Knight · King · Rook", math: "halftone field" },
  { label: "Fundamental Analysis", section: "strategy", fig: "Fundamentals", math: "growth · mix · distribution · trend" },
  { label: "Technical Analysis", section: "strategy", fig: "Price and moving averages", math: "EMA₁₂ · EMA₂₆" },
  { label: "Quantitative Research", section: "strategy", fig: "Implied volatility surface", math: "σ(k, T)" },
  { label: "Close", section: "close", fig: "Möbius strip", math: "one surface · one edge" },
];

export function SceneHud() {
  const [active, setActive] = useState(0);
  const anchors = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const collect = () => {
      anchors.current = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).sort(
        (a, b) => Number(a.dataset.scene) - Number(b.dataset.scene),
      );
    };
    collect();

    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--rdc-progress", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestD = Infinity;
      anchors.current.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== last) {
        last = best;
        setActive(best);
        root.dataset.rdcSection = SCENES[best]?.section ?? "top";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.removeProperty("--rdc-progress");
      delete root.dataset.rdcSection;
    };
  }, []);

  return (
    <>
      <nav className="rdc-rail" aria-label="Sections">
        <ol>
          {SCENES.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={s.label}
                aria-current={i === active ? "step" : undefined}
                onClick={() => scrollToAnchor(anchors.current[i] ?? null, i === 0)}
              >
                <span className="rdc-rail-label" aria-hidden="true">{s.label}</span>
                <span className="rdc-rail-tick" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="rdc-caption" aria-hidden="true">
        {SCENES.map((s, i) => (
          <p key={i} className={i === active ? "is-on" : undefined}>
            <span className="rdc-caption-n">Fig. {String(i + 1).padStart(2, "0")}</span>
            <span className="rdc-caption-t">{s.fig}</span>
            <span className="rdc-caption-m">{s.math}</span>
          </p>
        ))}
      </div>
    </>
  );
}
