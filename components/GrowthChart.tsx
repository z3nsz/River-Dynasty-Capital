"use client";

import { indexValue, monthYear } from "@/lib/format";
import { BENCHMARK_LABEL } from "@/lib/config";
import type { Snapshot } from "@/lib/types";

interface Pt {
  date: string;
  portfolio: number;
  sp: number;
  live?: boolean;
}

/**
 * Indexed growth chart. Both series start at 100 on the inception date. Driven
 * by daily `snapshots`; we append one live "today" point on top. It never says
 * "$" — it's an index.
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
  const today = new Date().toISOString().slice(0, 10);

  const series: Pt[] = snapshots
    .map((s) => ({
      date: s.date,
      portfolio: Number(s.portfolio_index),
      sp: Number(s.sp_index),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (live && live.portfolio != null && live.sp != null) {
    const livePt: Pt = {
      date: today,
      portfolio: live.portfolio,
      sp: live.sp,
      live: true,
    };
    if (series.length && series[series.length - 1].date === today) {
      series[series.length - 1] = livePt;
    } else {
      series.push(livePt);
    }
  }

  const historyCount = snapshots.filter((s) => s.date !== today).length;
  const thin = series.length < 3;

  const width = 720;
  const height = 260;
  const padL = 44;
  const padR = 56;
  const padT = 16;
  const padB = 28;

  const allVals = series.flatMap((p) => [p.portfolio, p.sp]).concat([100]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const vSpan = maxV - minV || 1;
  const vlo = minV - vSpan * 0.08;
  const vhi = maxV + vSpan * 0.08;

  const t0 = new Date(series[0]?.date ?? today).getTime();
  const t1 = new Date(series[series.length - 1]?.date ?? today).getTime();
  const tSpan = t1 - t0 || 1;

  const x = (d: string) =>
    padL + ((new Date(d).getTime() - t0) / tSpan) * (width - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - vlo) / (vhi - vlo)) * (height - padT - padB);

  const line = (key: "portfolio" | "sp") =>
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");

  const last = series[series.length - 1];
  const gridVals = niceTicks(vlo, vhi, 4);

  return (
    <figure className="rounded-sm border border-hairline bg-paper p-4 sm:p-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-lg">Indexed growth</span>
        <span className="text-xs text-muted">Indexed to 100 at inception</span>
      </figcaption>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={`Indexed growth of ${portfolioName} versus ${BENCHMARK_LABEL}, both starting at 100`}
        >
          {gridVals.map((v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y(v)}
                y2={y(v)}
                stroke="#DBDED8"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={y(v) + 3}
                textAnchor="end"
                className="tnum"
                fontSize="10"
                fill="#5A6169"
              >
                {v.toFixed(0)}
              </text>
            </g>
          ))}

          {/* benchmark — dashed */}
          <path
            d={line("sp")}
            fill="none"
            stroke="#5A6169"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {/* portfolio — solid */}
          <path
            d={line("portfolio")}
            fill="none"
            stroke="#1E3A5F"
            strokeWidth={2}
          />

          {last && (
            <>
              <circle cx={x(last.date)} cy={y(last.portfolio)} r={3} fill="#1E3A5F" />
              <circle cx={x(last.date)} cy={y(last.sp)} r={3} fill="#5A6169" />
              <text
                x={x(last.date) + 6}
                y={y(last.portfolio) + 3}
                className="tnum"
                fontSize="11"
                fontWeight="600"
                fill="#1E3A5F"
              >
                {indexValue(last.portfolio)}
              </text>
              <text
                x={x(last.date) + 6}
                y={y(last.sp) + 3}
                className="tnum"
                fontSize="11"
                fill="#5A6169"
              >
                {indexValue(last.sp)}
              </text>
            </>
          )}

          <text x={padL} y={height - 8} fontSize="10" fill="#5A6169">
            {series[0] ? monthYear(series[0].date) : ""}
          </text>
          <text
            x={width - padR}
            y={height - 8}
            textAnchor="end"
            fontSize="10"
            fill="#5A6169"
          >
            {last?.live ? "now" : last ? monthYear(last.date) : ""}
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-navy" /> {portfolioName}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#5A6169 0 4px,transparent 4px 7px)",
            }}
          />
          {BENCHMARK_LABEL}
        </span>
        {thin && (
          <span>
            {historyCount === 0
              ? "History builds up as monthly snapshots are logged — only the current point is shown for now."
              : "Only a few snapshots logged so far."}
          </span>
        )}
      </div>
    </figure>
  );
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
