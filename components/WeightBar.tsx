import { pctValue } from "@/lib/format";

/** Horizontal weight bar, scaled to the largest weight in the current view. */
export function WeightBar({
  weight,
  max,
}: {
  weight: number;
  max: number;
}) {
  const frac = max > 0 ? Math.max(0, Math.min(1, weight / max)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 shrink-0 rounded-sm bg-hairline sm:w-24"
        role="img"
        aria-label={`Weight ${pctValue(weight)}`}
      >
        <div
          className="h-full rounded-sm bg-navy"
          style={{ width: `${(frac * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="tnum text-sm text-ink">{pctValue(weight)}</span>
    </div>
  );
}
