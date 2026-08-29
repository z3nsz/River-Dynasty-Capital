import type { RecentPoint } from "@/lib/types";

/**
 * Tiny price-trace sparkline. Pure SVG, no library. The series is the rolling
 * `recent` array from the price cache — it builds up over time, so early on it
 * may be short or empty (we render a flat hairline then).
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  positive,
}: {
  points: RecentPoint[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  const stroke = positive == null ? "#5A6169" : positive ? "#1B6B4A" : "#B23A2E";

  if (!points || points.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Not enough price history yet"
        className="overflow-visible"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#DBDED8"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.p);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = 2;

  const coords = points.map((p) => {
    const x = pad + ((p.t - minX) / spanX) * (width - pad * 2);
    const y = height - pad - ((p.p - minY) / spanY) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Recent price trend, ${points.length} points`}
      className="overflow-visible"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
