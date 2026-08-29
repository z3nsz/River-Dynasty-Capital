"use client";

import { useMemo, useState } from "react";
import { useLivePrices } from "./LivePricesProvider";
import { Sparkline } from "./Sparkline";
import { WeightBar } from "./WeightBar";
import { ReturnFigure } from "./ReturnFigure";
import { longDate, pctValue } from "@/lib/format";
import type { HoldingRow } from "@/lib/sleeveMetrics";

type SortKey = "weight" | "return" | "ticker";

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  const { changed } = useLivePrices();
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [dir, setDir] = useState<1 | -1>(-1);

  const maxWeight = useMemo(
    () => Math.max(0, ...holdings.map((h) => h.weightPct)),
    [holdings],
  );

  const sorted = useMemo(() => {
    const rows = [...holdings];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "weight") cmp = a.weightPct - b.weightPct;
      else cmp = (a.ret ?? -Infinity) - (b.ret ?? -Infinity);
      return cmp * dir;
    });
    return rows;
  }, [holdings, sortKey, dir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(k === "ticker" ? 1 : -1);
    }
  };

  return (
    <section aria-labelledby="holdings-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
        <h2 id="holdings-heading" className="font-display text-xl">
          Holdings
        </h2>
        <div className="flex items-center gap-1 text-xs text-muted">
          <span className="mr-1">sort</span>
          {(["weight", "return", "ticker"] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              aria-pressed={sortKey === k}
              className={`rounded-sm px-1.5 py-0.5 ${
                sortKey === k
                  ? "bg-navy text-paper"
                  : "border border-hairline hover:bg-ink/5"
              }`}
            >
              {k}
              {sortKey === k ? (dir === 1 ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
      </div>

      <ul>
        {sorted.map((h) => {
          const flash = changed[h.ticker.toUpperCase()];
          const positive = h.ret == null ? undefined : h.ret >= 0;
          return (
            <li
              key={h.id}
              className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 border-b border-hairline py-4 sm:grid-cols-[minmax(0,10rem)_6rem_1fr_auto] sm:items-center sm:gap-x-6"
            >
              {/* ticker block */}
              <div className="min-w-0">
                <div className="tnum text-base font-semibold">{h.ticker}</div>
                <div className="truncate text-sm text-muted">{h.company}</div>
                <div className="tnum mt-0.5 text-xs text-muted">
                  entry {longDate(h.entryDate)}
                  {h.priceSource === "manual" ? " · manual price" : ""}
                  {h.priceSource === "none" ? " · no price" : ""}
                </div>
              </div>

              {/* sparkline */}
              <div className="order-3 hidden sm:order-none sm:block">
                <Sparkline points={h.recent} positive={positive} />
              </div>

              {/* return */}
              <div className="order-2 text-right sm:order-none sm:text-left">
                <ReturnFigure ratio={h.ret} flash={flash} />
              </div>

              {/* weight */}
              <div className="order-4 sm:order-none">
                <WeightBar weight={h.weightPct} max={maxWeight} />
              </div>

              {/* thesis */}
              <p className="order-5 col-span-2 max-w-prose text-sm leading-relaxed text-ink/90 sm:col-span-4">
                {h.thesis}
              </p>
            </li>
          );
        })}
      </ul>

      {holdings.length === 0 && (
        <p className="py-8 text-sm text-muted">No open positions.</p>
      )}

      <p className="tnum mt-3 text-xs text-muted">
        {holdings.length} open position{holdings.length === 1 ? "" : "s"} · weights
        sum to {pctValue(holdings.reduce((s, h) => s + h.weightPct, 0))}
      </p>
    </section>
  );
}
