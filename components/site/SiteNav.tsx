"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

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
      <a href="#top" className="rdc-nav-brand" aria-label="River Dynasty Capital — back to top">
        <Logo size={26} className="rdc-nav-logo" />
        <span>River Dynasty Capital</span>
      </a>
      <nav aria-label="Primary" className="rdc-nav-links">
        <a href="#firm" className="rdc-nav-link">Firm</a>
        <a href="#strategy" className="rdc-nav-link">Strategy</a>
        <Link href="/portfolio" className="rdc-nav-login">Investor Login</Link>
      </nav>
    </header>
  );
}
