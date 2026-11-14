import { Logo } from "@/components/Logo";

/**
 * Opening sequence: the mark on the page colour, a hairline that fills, then
 * the cover lifts as the particle field assembles and the headline rises.
 *
 * The whole timeline is CSS (see "intro" in site.css), so it cannot hang if a
 * script fails. It plays once per browser session: the inline script marks
 * later loads with .rdc-seen on <html> before first paint, which hides the
 * cover and restores the short headline delay. Reduced motion never sees it.
 */
const SEEN = `try{if(sessionStorage.getItem("rdc-intro")){document.documentElement.classList.add("rdc-seen")}else{sessionStorage.setItem("rdc-intro","1")}}catch(e){}`;

export function Intro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SEEN }} />
      <div className="rdc-intro" aria-hidden="true">
        <Logo size={44} className="rdc-nav-logo" />
        <i />
      </div>
    </>
  );
}
