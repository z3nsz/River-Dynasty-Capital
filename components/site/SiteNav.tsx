"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * In-page links glide to the same position the section snap settles on (the
 * section's own scene anchor centred in the viewport, or the top), so a nav
 * click and a scroll both land on the identical composition.
 */
function goTo(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  let top = 0;
  if (id !== "top") {
    const anchor = el.matches("[data-scene]") ? el : el.querySelector<HTMLElement>("[data-scene]") ?? el;
    const r = anchor.getBoundingClientRect();
    top = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  history.replaceState(null, "", `#${id}`);
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`rdc-nav${scrolled ? " is-scrolled" : ""}`}>
      <a
        href="#top"
        className="rdc-nav-brand"
        aria-label="River Dynasty Capital — back to top"
        onClick={(e) => goTo(e, "top")}
      >
        <Logo size={26} className="rdc-nav-logo" />
        <span>River Dynasty Capital</span>
      </a>
      <nav aria-label="Primary" className="rdc-nav-links">
        <a href="#firm" className="rdc-nav-link" onClick={(e) => goTo(e, "firm")}>Firm</a>
        <a href="#strategy" className="rdc-nav-link" onClick={(e) => goTo(e, "strategy")}>Strategy</a>
        <Link href="/portfolio" className="rdc-nav-login">Investor Login</Link>
      </nav>
    </header>
  );
}
