/**
 * Glide to a scene anchor: the same position the section snap settles on
 * (the anchor centred in the viewport, or the very top for the hero), so a
 * click and a scroll always land on the identical composition.
 */
export function scrollToAnchor(anchor: HTMLElement | null, top = false) {
  let y = 0;
  if (anchor && !top) {
    const r = anchor.getBoundingClientRect();
    y = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
}

/** The scene anchor for a section id: the element itself or its first [data-scene]. */
export function anchorFor(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) return null;
  return el.matches("[data-scene]") ? el : el.querySelector<HTMLElement>("[data-scene]") ?? el;
}
