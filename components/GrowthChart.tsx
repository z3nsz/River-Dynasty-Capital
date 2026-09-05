"use client";

import { useMemo, useRef, useState } from "react";
import { pct, longDate, signClass } from "@/lib/format";
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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

  // Y axis auto-fits the visible data (it does NOT force 0 into range) so the
  // gap between the two lines is easy to read. The zero line still draws when
  // 0 happens to fall inside the fitted range.
  const vals = view.flatMap((p) => [p.portfolio, p.sp]);
  const rawMin = vals.length ? Math.min(...vals) : -1;
  const rawMax = vals.length ? Math.max(...vals) : 1;
  const rawSpan = rawMax - rawMin;
  let vlo: number;
  let vhi: number;
  if (rawSpan < 1) {
    const c = (rawMax + rawMin) / 2;
    vlo = c - 1.5;
    vhi = c + 1.5;
  } else {
    const pad = Math.max(rawSpan * 0.1, 0.5);
    vlo = rawMin - pad;
    vhi = rawMax + pad;
  }

  const t0 = new Date(view[0]?.date ?? today).getTime();
  const t1 = new Date(view[view.length - 1]?.date ?? today).getTime();
  const tSpan = t1 - t0 || 1;

  const xMs = (ms: number) =>
    view.length <= 1
      ? (padL + width - padR) / 2
      : padL + ((ms - t0) / tSpan) * (width - padL - padR);
  const x = (d: string) => xMs(new Date(d).getTime());
  const y = (v: number) =>
    padT + (1 - (v - vlo) / (vhi - vlo)) * (height - padT - padB);

  const xTicks = useMemo(() => timeTicks(t0, t1), [t0, t1]);

  const line = (key: "portfolio" | "sp") =>
    view
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");

  const last = view[view.length - 1];
  const first = view[0];
  const gridVals = niceTicks(vlo, vhi, 4);
  const zeroInRange = vlo < 0 && vhi > 0;

  const hover =
    hoverIdx != null && hoverIdx >= 0 && hoverIdx < view.length ? view[hoverIdx] : null;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || view.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padL, Math.min(width - padR, vbX));
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < view.length; i++) {
      const d = Math.abs(x(view[i].date) - clamped);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHoverIdx(best);
  }

  // Tooltip geometry (SVG units).
  const tipLines = hover
    ? [
        longDate(hover.date),
        `${portfolioName}  ${fmtPct(hover.portfolio)}`,
        `${BENCHMARK_LABEL}  ${fmtPct(hover.sp)}`,
      ]
    : [];
  const tipW = Math.max(90, ...tipLines.map((s) => s.length * 5.6)) + 14;
  const tipH = 14 + tipLines.length * 13;
  const hoverX = hover ? x(hover.date) : 0;
  const tipX =
    hoverX + 12 + tipW > width - padR ? hoverX - 12 - tipW : hoverX + 12;

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
            onClick={() => {
              setRange(r);
              setHoverIdx(null);
            }}
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
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[520px] cursor-crosshair"
          role="img"
          aria-label={`Cumulative percent return of ${portfolioName} versus ${BENCHMARK_LABEL} over ${range}. ${portfolioName} ${
            portNow == null ? "—" : fmtPct(portNow)
          }, ${BENCHMARK_LABEL} ${spNow == null ? "—" : fmtPct(spNow)}.`}
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {/* vertical date gridlines (behind the data) */}
          {xTicks.map((tk, i) => (
            <line
              key={`vg-${i}`}
              x1={xMs(tk.ms)}
              x2={xMs(tk.ms)}
              y1={padT}
              y2={height - padB}
              stroke="#E4E7E1"
              strokeWidth={1}
            />
          ))}

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

          {/* x-axis date markers — evenly spaced, auto-scaled to the window */}
          {xTicks.map((tk, i) => {
            const tx = xMs(tk.ms);
            const anchor =
              tx < padL + 14 ? "start" : tx > width - padR - 14 ? "end" : "middle";
            const lx = anchor === "start" ? padL : anchor === "end" ? width - padR : tx;
            return (
              <g key={`xt-${i}`}>
                <line
                  x1={tx}
                  x2={tx}
                  y1={height - padB}
                  y2={height - padB + 4}
                  stroke="#B9BEB4"
                  strokeWidth={1}
                />
                <text
                  x={lx}
                  y={height - 8}
                  textAnchor={anchor}
                  fontSize="10"
                  fill="#5A6169"
                  className="tnum"
                >
                  {tk.label}
                </text>
              </g>
            );
          })}

          {hover && (
            <g pointerEvents="none">
              <line
                x1={hoverX}
                x2={hoverX}
                y1={padT}
                y2={height - padB}
                stroke="#9AA1A8"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={hoverX} cy={y(hover.sp)} r={3.5} fill="#5A6169" stroke="#F5F6F4" strokeWidth={1.5} />
              <circle cx={hoverX} cy={y(hover.portfolio)} r={4} fill="#1E3A5F" stroke="#F5F6F4" strokeWidth={1.5} />
              <g transform={`translate(${tipX} ${padT})`}>
                <rect
                  width={tipW}
                  height={tipH}
                  rx={4}
                  fill="#14181C"
                  opacity={0.96}
                />
                {tipLines.map((s, i) => (
                  <text
                    key={i}
                    x={7}
                    y={13 + i * 13}
                    className="tnum"
                    fontSize={i === 0 ? 9.5 : 10.5}
                    fontWeight={i === 1 ? 600 : 400}
                    fill={i === 0 ? "#9AA1A8" : i === 1 ? "#EDEFF2" : "#B9BEB4"}
                  >
                    {s}
                  </text>
                ))}
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-navy" /> {portfolioName}{" "}
          <span className={`tnum font-medium ${signClass(portNow, { neutral: "text-ink" })}`}>
            {portNow == null ? "—" : fmtPct(portNow)}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,#5A6169 0 4px,transparent 4px 7px)" }}
          />
          {BENCHMARK_LABEL}{" "}
          <span className={`tnum font-medium ${signClass(spNow, { neutral: "text-ink" })}`}>
            {spNow == null ? "—" : fmtPct(spNow)}
          </span>
        </span>
        {range === "ALL" ? (
          <span>since inception</span>
        ) : (
          <span>
            return over {rangeLabel(range)}:{" "}
            <span className={`tnum font-medium ${signClass(portWindow)}`}>
              {portWindow == null ? "—" : `${portWindow >= 0 ? "+" : "−"}${Math.abs(portWindow).toFixed(1)} pp`}
            </span>{" "}
            fund ·{" "}
            <span className={`tnum font-medium ${signClass(spWindow)}`}>
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

  if (range === "5D") {
    // "Last 5 trading days" means exactly that — the last 5 recorded sessions
    // (6 points: the day-0 baseline plus 5 daily moves) — not a calendar
    // cutoff, which would over- or under-count around weekends/holidays.
    const n = Math.min(6, full.length);
    const view = full.slice(-n);
    if (view.length < 2) return { view: full, thin: true, truncated: true };
    return { view, thin: view.length < 3, truncated: full.length < 6 };
  }

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
  if (span <= 0) return [round2(lo)];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) {
    const r = round2(v);
    if (out[out.length - 1] !== r) out.push(r);
  }
  return out;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_MS = 86_400_000;

interface XTick {
  ms: number;
  label: string;
}

/**
 * Evenly spaced date markers for the x-axis, sized to the visible span so the
 * axis reads correctly as new dates land (e.g. an Aug→Sep window shows both
 * months, not just "Aug").
 */
function timeTicks(t0: number, t1: number): XTick[] {
  const span = t1 - t0;
  if (span <= 0) {
    const d = new Date(t0);
    return [{ ms: t0, label: `${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }];
  }
  const spanDays = span / DAY_MS;

  // -- day scale: markers on the 1st plus every Nth day of each month --
  if (spanDays <= 55) {
    const step = spanDays <= 8 ? 1 : spanDays <= 15 ? 2 : spanDays <= 28 ? 3 : 5;
    const out: XTick[] = [];
    let y = new Date(t0).getUTCFullYear();
    let m = new Date(t0).getUTCMonth();
    while (Date.UTC(y, m, 1) <= t1) {
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const days = new Set<number>([1]);
      for (let d = step; d <= dim; d += step) days.add(d);
      for (const d of [...days].sort((a, b) => a - b)) {
        const ms = Date.UTC(y, m, d);
        if (ms >= t0 && ms <= t1) out.push({ ms, label: `${MON[m]} ${d}` });
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return thin(out.length ? out : fallbackEdges(t0, t1), 8);
  }

  // -- month scale --
  if (spanDays <= 430) {
    return thin(monthTicks(t0, t1, spanDays <= 130 ? 1 : spanDays <= 270 ? 2 : 3), 9);
  }

  // -- quarter / year scale --
  return thin(monthTicks(t0, t1, spanDays <= 1300 ? 3 : spanDays <= 2600 ? 6 : 12), 9);
}

function monthTicks(t0: number, t1: number, stepMonths: number): XTick[] {
  const out: XTick[] = [];
  let y = new Date(t0).getUTCFullYear();
  let m = new Date(t0).getUTCMonth();
  if (Date.UTC(y, m, 1) < t0) {
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  let count = 0;
  while (Date.UTC(y, m, 1) <= t1) {
    if (count % stepMonths === 0) {
      const showYear = m === 0 || out.length === 0;
      out.push({
        ms: Date.UTC(y, m, 1),
        label: showYear ? `${MON[m]} '${String(y).slice(2)}` : MON[m],
      });
    }
    count++;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

function fallbackEdges(t0: number, t1: number): XTick[] {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  return [
    { ms: t0, label: fmt(t0) },
    { ms: t1, label: fmt(t1) },
  ];
}

function thin(ticks: XTick[], max: number): XTick[] {
  let out = ticks;
  while (out.length > max) {
    const kept = out.filter((_, i) => i % 2 === 0);
    if (kept[kept.length - 1] !== out[out.length - 1]) kept.push(out[out.length - 1]);
    out = kept;
  }
  return out;
}
