"use client";

import { pct, pp, signClass } from "@/lib/format";
import { BENCHMARK_LABEL } from "@/lib/config";
import type { SleeveMetrics } from "@/lib/sleeveMetrics";

/** The four headline numbers. Percentages and points only — never money. */
export function HeadlineStats({ m }: { m: SleeveMetrics }) {
  const years = m.ageYears;
  const yearsLabel =
    years >= 1 ? `${years.toFixed(1)} yr` : `${Math.round(years * 12)} mo`;

  const cells = [
    {
      label: "Total return since inception",
      value: pct(m.totalReturn),
      cls: signClass(m.totalReturn),
      sub: `since ${m.meta.inceptionDate}`,
    },
    {
      label: "Annualized (CAGR)",
      value: pct(m.cagr),
      cls: signClass(m.cagr),
      sub: `over ${yearsLabel}`,
    },
    {
      label: `${BENCHMARK_LABEL} · same period`,
      value: pct(m.benchmarkReturn),
      cls: signClass(m.benchmarkReturn),
      sub: "benchmark",
    },
    {
      label: "Excess vs benchmark",
      value: pp(m.excessPP),
      cls: signClass(m.excessPP == null ? null : m.excessPP / 100),
      sub: "percentage points",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-hairline bg-hairline lg:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="bg-paper p-4 sm:p-5">
          <dt className="text-xs uppercase tracking-wide text-muted">{c.label}</dt>
          <dd className={`tnum mt-2 text-2xl font-medium sm:text-3xl ${c.cls}`}>
            {c.value}
          </dd>
          <dd className="tnum mt-1 text-xs text-muted">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
