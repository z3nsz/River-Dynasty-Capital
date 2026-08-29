"use client";

import { useMemo, useState } from "react";
import { pct, longDate, monthYear } from "@/lib/format";
import { BENCHMARK_LABEL } from "@/lib/config";
import type { Snapshot } from "@/lib/types";

type Range = "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";
const RANGES: Range[] = ["5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"];

interface Pt {
  date: string;
  /** cumulative return since inception, in percent (e.g. 47.6) */
  portfolio: number;
  sp: number;
  live?: boolean;
}

/** "+47.6%" / "−12.0%" / "0.0%" */
function fmtPct(v: number): string {
  return pct(v / 100, 1);
}

/**
 * Performance chart: cumulative % return since inception for the fund vs the
 * S&P 500. The stored snapshots are 100-indexed; here they're shown as return
 * (index − 100), so today reads e.g. "+47.6%". Timeframe buttons zoom the
 * x-axis and rescale the y-axis. A live "now" point is always drawn. No "$".
 */
export function GrowthChart({
  snapshots,
  live,
  portfolioName,
}: {
  snapshots: Snapshot[];
  live: { portfolio: number | null; sp: number | null } | null;
  portfolioName: string;
}) {
  const [range, setRange] = useState<Range>("ALL");
  const today = new Date().toISOString().slice(0, 10);

  const full: Pt[] = useMemo(() => {
    const s: Pt[] = snapshots
      .map((r) => ({
        date: r.date,
        portfolio: Number(r.portfolio_index) - 100,
        sp: Number(r.sp_index) - 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (live && live.portfolio != null && live.sp != null) {
      const livePt: Pt = {
        date: today,
        portfolio: live.portfolio - 100,
        sp: live.sp - 100,
        live: true,
      };
      if (s.length && s[s.length - 1].date === today) s[s.length - 1] = livePt;
      else s.push(livePt);
    }
    return s;
  }, [snapshots, live, today]);

  const recordedFrom = full.length ? full[0].date : null;
  const { view, thin, truncated } = useMemo(() => windowed(full, range), [full, range]);

  const width = 720;
  const height = 260;
  const padL = 52;
  const padR = 64;
  const padT = 16;
  const padB = 28;

  const vals = view.flatMap((p) => [p.portfolio, p.sp]);
  const rawMin = vals.length ? Math.min(...vals, 0) : -1;
  const rawMax = vals.length ? Math.max(...vals, 0) : 1;
  let vlo: number;
  let vhi: number;
  if (rawMax - rawMin < 1) {
    const c = (rawMax + rawMin) / 2;
    vlo = c - 2;
    vhi = c + 2;
  } else {
    const span = rawMax - rawMin;
    vlo = rawMin - span * 0.12;
    vhi = rawMax + span * 0.12;
  }

  const t0 = new Date(view[0]?.date ?? today).getTime();
  const t1 = new Date(view[view.length - 1]?.date ?? today).getTime();
  const tSpan = t1 - t0 || 1;

  const x = (d: string) =>
    view.length <= 1
      ? (padL + width - padR) / 2
      : padL + ((new Date(d).getTime() - t0) / tSpan) * (width - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - vlo) / (vhi - vlo)) * (height - padT - padB);

  const line = (key: "portfolio" | "sp") =>
    view
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");

  const last = view[view.length - 1];
  const first = view[0];
  const gridVals = niceTicks(vlo, vhi, 4);
  const zeroInRange = vlo < 0 && vhi > 0;

  const portNow = last ? last.portfolio : null;
  const spNow = last ? last.sp : null;
  const portWindow =
    last && first && range !== "ALL" ? last.portfolio - first.portfolio : null;
  const spWindow =
    last && first && range !== "ALL" ? last.sp - first.sp : null;

  return (
    <figure className="rounded-sm border border-hairline bg-paper p-4 sm:p-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-lg">Performance</span>
        <span className="text-xs text-muted">% return since inception</span>
      </figcaption>

      <div className="mb-3 flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`tnum rounded-sm px-2 py-0.5 text-xs ${
              range === r
                ? "bg-navy text-paper"
                : "border border-hairline text-muted hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {r === "ALL" ? "All" : r}
          </button>
        ))}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={`Cumulative percent return of ${portfolioName} versus ${BENCHMARK_LABEL} over ${range}`}
        >
          {gridVals.map((v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 && zeroInRange ? "#B9BEB4" : "#DBDED8"}
                strokeWidth={v === 0 && zeroInRange ? 1.25 : 1}
              />
              <text x={padL - 8} y={y(v) + 3} textAnchor="end" className="tnum" fontSize="10" fill="#5A6169">
                {v > 0 ? `+${v}%` : `${v}%`}
              </text>
            </g>
          ))}

          <path d={line("sp")} fill="none" stroke="#5A6169" strokeWidth={1.5} strokeDasharray="4 3" />
          <path d={line("portfolio")} fill="none" stroke="#1E3A5F" strokeWidth={2} />

          {last && (
            <>
              <circle cx={x(last.date)} cy={y(last.portfolio)} r={3} fill="#1E3A5F" />
              <circle cx={x(last.date)} cy={y(last.sp)} r={3} fill="#5A6169" />
              <text x={x(last.date) + 6} y={y(last.portfolio) + 3} className="tnum" fontSize="11" fontWeight="600" fill="#1E3A5F">
                {fmtPct(last.portfolio)}
              </text>
              <text x={x(last.date) + 6} y={y(last.sp) + 3} className="tnum" fontSize="11" fill="#5A6169">
                {fmtPct(last.sp)}
              </text>
            </>
          )}

          <text x={padL} y={height - 8} fontSize="10" fill="#5A6169">
            {view.length > 1 && first ? monthYear(first.date) : ""}
          </text>
          <text x={width - padR} y={height - 8} textAnchor="end" fontSize="10" fill="#5A6169">
            {last?.live ? "now" : last ? monthYear(last.date) : ""}
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-navy" /> {portfolioName}{" "}
          <span className="tnum text-ink">{portNow == null ? "—" : fmtPct(portNow)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,#5A6169 0 4px,transparent 4px 7px)" }}
          />
          {BENCHMARK_LABEL}{" "}
          <span className="tnum text-ink">{spNow == null ? "—" : fmtPct(spNow)}</span>
        </span>
        {range === "ALL" ? (
          <span>since inception</span>
        ) : (
          <span>
            {rangeLabel(range)}:{" "}
            <span className="tnum">
              {portWindow == null ? "—" : `${portWindow >= 0 ? "+" : "−"}${Math.abs(portWindow).toFixed(1)} pp`}
            </span>{" "}
            fund ·{" "}
            <span className="tnum">
              {spWindow == null ? "—" : `${spWindow >= 0 ? "+" : "−"}${Math.abs(spWindow).toFixed(1)} pp`}
            </span>{" "}
            {BENCHMARK_LABEL}
          </span>
        )}
        {truncated ? (
          <span>· only {view.length} point{view.length === 1 ? "" : "s"} recorded so far</span>
        ) : (
          thin && <span>· history builds up daily</span>
        )}
        {recordedFrom && <span>· recorded from {longDate(recordedFrom)}</span>}
      </div>
    </figure>
  );
}

function rangeLabel(r: Range): string {
  return (
    {
      "5D": "5 days",
      "1M": "1 month",
      "3M": "3 months",
      "6M": "6 months",
      YTD: "year to date",
      "1Y": "1 year",
      "5Y": "5 years",
      ALL: "all time",
    } as Record<Range, string>
  )[r];
}

function cutoffFor(range: Range, now: Date): Date | null {
  const d = new Date(now);
  switch (range) {
    case "5D":
      d.setDate(d.getDate() - 7);
      return d;
    case "1M":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "YTD":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case "5Y":
      d.setFullYear(d.getFullYear() - 5);
      return d;
    case "ALL":
      return null;
  }
}

interface Windowed {
  view: Pt[];
  thin: boolean;
  truncated: boolean;
}

function windowed(full: Pt[], range: Range): Windowed {
  if (full.length === 0) return { view: [], thin: true, truncated: false };

  const cutoff = cutoffFor(range, new Date());
  if (!cutoff) return { view: full, thin: full.length < 3, truncated: false };

  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const inWindow = full.filter((p) => p.date >= cutoffKey);
  const beforeIdx = full.findLastIndex((p) => p.date < cutoffKey);
  const view = beforeIdx >= 0 ? [full[beforeIdx], ...inWindow] : inWindow;

  if (view.length < 2) return { view: full, thin: true, truncated: true };
  return { view, thin: view.length < 3, truncated: false };
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [Math.round(lo)];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi; v += step) out.push(Math.round(v));
  return out;
}
