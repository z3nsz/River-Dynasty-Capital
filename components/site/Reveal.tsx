"use client";

import { useEffect } from "react";

/** Adds .is-in to [data-reveal] elements as they enter the viewport. */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Chart panels pop in later: once a third of the panel is on screen.
    const pops = Array.from(document.querySelectorAll<HTMLElement>("[data-pop]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      [...els, ...pops].forEach((el) => el.classList.add("is-in"));
      return;
    }
    // One-shot: once an element is in, it stays in.
    const onEnter: IntersectionObserverCallback = (entries, observer) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          observer.unobserve(e.target);
        }
      }
    };
    const io = new IntersectionObserver(onEnter, { rootMargin: "0px 0px -12% 0px" });
    const popIo = new IntersectionObserver(onEnter, { threshold: 0.35 });
    els.forEach((el) => io.observe(el));
    pops.forEach((el) => popIo.observe(el));
    return () => {
      io.disconnect();
      popIo.disconnect();
    };
  }, []);
  return null;
}
