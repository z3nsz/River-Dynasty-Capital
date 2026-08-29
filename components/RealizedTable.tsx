import { ReturnFigure } from "./ReturnFigure";
import { longDate } from "@/lib/format";
import type { ClosedRow } from "@/lib/sleeveMetrics";

/** Closed / sold positions — kept visible so the record stays honest. */
export function RealizedTable({ closed }: { closed: ClosedRow[] }) {
  if (closed.length === 0) {
    return (
      <section aria-labelledby="realized-heading" className="mt-12">
        <h2
          id="realized-heading"
          className="border-b border-ink pb-2 font-display text-xl"
        >
          Realized / closed
        </h2>
        <p className="py-6 text-sm text-muted">
          No positions have been closed yet.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="realized-heading" className="mt-12">
      <h2
        id="realized-heading"
        className="border-b border-ink pb-2 font-display text-xl"
      >
        Realized / closed
      </h2>
      <ul>
        {[...closed]
          .sort((a, b) => (b.exitDate ?? "").localeCompare(a.exitDate ?? ""))
          .map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-hairline py-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
            >
              <div className="min-w-0">
                <span className="tnum font-semibold">{c.ticker}</span>{" "}
                <span className="text-sm text-muted">{c.company}</span>
              </div>
              <div className="tnum text-xs text-muted">
                held {longDate(c.entryDate)} →{" "}
                {c.exitDate ? longDate(c.exitDate) : "—"}
              </div>
              <div className="text-right">
                <ReturnFigure ratio={c.ret} size="md" />
              </div>
            </li>
          ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Realized return = (exit − entry) / entry, per position.
      </p>
    </section>
  );
}
