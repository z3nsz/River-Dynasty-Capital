"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { anchorFor, scrollToAnchor } from "./scrollTo";

/**
 * An in-page link that glides to the same position the section snap settles
 * on, so a click and a scroll land on the identical composition.
 */
export function SectionLink({
  id,
  className,
  label,
  children,
}: {
  id: string;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const anchor = anchorFor(id);
    if (!anchor) return;
    e.preventDefault();
    scrollToAnchor(anchor, id === "top");
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <a href={`#${id}`} className={className} aria-label={label} onClick={onClick}>
      {children}
    </a>
  );
}

/** Investor Login: the one call to action, with an arrow that leans forward on hover. */
export function LoginLink() {
  return (
    <Link href="/portfolio" className="rdc-nav-login">
      <span>Investor Login</span>
      <span className="rdc-arrow" aria-hidden="true">→</span>
    </Link>
  );
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
      <SectionLink id="top" className="rdc-nav-brand" label="River Dynasty Capital — back to top">
        <Logo size={26} className="rdc-nav-logo" />
        <span>River Dynasty Capital</span>
      </SectionLink>
      <nav aria-label="Primary" className="rdc-nav-links">
        <SectionLink id="firm" className="rdc-nav-link">Firm</SectionLink>
        <SectionLink id="strategy" className="rdc-nav-link">Strategy</SectionLink>
        <LoginLink />
      </nav>
      <span className="rdc-progress" aria-hidden="true" />
    </header>
  );
}
