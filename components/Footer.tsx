export function Footer() {
  return (
    <footer className="mt-16 border-t border-hairline pt-6 pb-12 text-xs leading-relaxed text-muted">
      <p className="max-w-prose">
        Personal portfolio track record. Not investment advice and not an offer of
        any fund or services.
      </p>
      <p className="mt-2 max-w-prose">
        All figures are percentages. Returns are computed from average cost per
        share versus current price per holding; the fund return is the
        weight-weighted average of holding returns. Prices are cached server-side
        and may be delayed — see the timestamp above.
      </p>
      <p className="tnum mt-3">River Dynasty Capital</p>
    </footer>
  );
}
