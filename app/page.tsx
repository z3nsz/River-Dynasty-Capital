import { LazyMathScene } from "@/components/site/LazyMathScene";
import { LoginLink, SectionLink, SiteNav } from "@/components/site/SiteNav";
import { SceneHud } from "@/components/site/SceneHud";
import { Reveal } from "@/components/site/Reveal";
import { Logo } from "@/components/Logo";
import { Words } from "@/components/site/Words";
import { TechnicalChart } from "@/components/site/viz/TechnicalChart";
import { MonteCarloChart } from "@/components/site/viz/MonteCarloChart";
import "./site.css";

// Fundamental has no panel: its bar chart is the particle scene itself, which
// sits in the right-hand column. Quant's panel is drawn without its box.
const DISCIPLINES = [
  { n: "01", title: "Fundamental Analysis", scene: 3, Viz: null, bare: false },
  { n: "02", title: "Technical Analysis", scene: 4, Viz: TechnicalChart, bare: true },
  { n: "03", title: "Quantitative Research", scene: 5, Viz: MonteCarloChart, bare: true },
];

export default function Home() {
  return (
    <div className="rdc-site" id="top">
      <LazyMathScene />
      {/* depth: a soft vignette and fine grain between the scene and the text */}
      <div className="rdc-atmos" aria-hidden="true" />
      <Reveal />
      <SiteNav />
      <SceneHud />

      <main>
        <section className="rdc-hero" data-scene="0">
          <h1 className="rdc-hero-title">
            <Words
              words={["Research", "Trade", "Invest"].map((w) => (
                <>
                  {w}
                  <span className="rdc-dot">.</span>
                </>
              ))}
            />
          </h1>
          <div className="rdc-scroll-cue" aria-hidden="true">
            <span>Scroll</span>
            <i />
          </div>
        </section>

        <section id="firm" className="rdc-firm" data-scene="1">
          <div className="rdc-firm-text" data-reveal>
            <p className="rdc-eyebrow rdc-kicker">The Firm</p>
            <p className="rdc-firm-line">
              <Words text="An independent proprietary investment and trading operation." />
            </p>
          </div>
        </section>

        <section id="strategy" className="rdc-strategy">
          <header className="rdc-strategy-head" data-scene="2">
            {/* the reveal watches the text itself: the header is nearly a
                screen tall, so it would fire while the heading is still below */}
            <div className="rdc-strategy-head-text" data-reveal>
              <p className="rdc-eyebrow rdc-kicker">Strategy</p>
              <h2>
                <Words text="Three disciplines. One approach." />
              </h2>
            </div>
          </header>

          {DISCIPLINES.map(({ n, title, scene, Viz, bare }) => (
            <article key={n} className="rdc-discipline" data-scene={scene}>
              <div className="rdc-discipline-text" data-reveal>
                <p className="rdc-eyebrow rdc-kicker rdc-discipline-n">
                  {n} <span>/ 03</span>
                </p>
                <h3>
                  <Words text={title} />
                </h3>
              </div>
              {Viz ? (
                <div className={bare ? "rdc-discipline-viz is-bare" : "rdc-discipline-viz"} data-pop>
                  <Viz />
                </div>
              ) : (
                <div aria-hidden="true" />
              )}
            </article>
          ))}
        </section>
      </main>

      <footer className="rdc-footer" data-scene="6">
        <div className="rdc-footer-row">
          <div className="rdc-footer-brand">
            <Logo size={28} className="rdc-nav-logo" />
            <span>River Dynasty Capital</span>
          </div>
          <nav aria-label="Footer" className="rdc-footer-links">
            <SectionLink id="firm" className="rdc-nav-link">Firm</SectionLink>
            <SectionLink id="strategy" className="rdc-nav-link">Strategy</SectionLink>
            <SectionLink id="top" className="rdc-nav-link">Back to top ↑</SectionLink>
          </nav>
          <LoginLink />
        </div>
        <p className="rdc-footer-legal">
          © {new Date().getFullYear()} River Dynasty Capital. Not investment advice and not an offer of any fund or
          services. Charts on this page use illustrative data.
        </p>
      </footer>
    </div>
  );
}
