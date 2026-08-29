/**
 * Formatting helpers. RULE: this module never emits a currency symbol. Returns
 * and weights are percentages; growth is an index number. No dollars anywhere.
 */

/** Percentage from a ratio (0.25 -> "+25.0%"). */
export function pct(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

/** Percentage from an already-percent value (25 -> "25.0%"), no forced sign. */
export function pctValue(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Percentage points, signed (e.g. excess return): 33.8 -> "+33.8 pp". */
export function pp(points: number | null | undefined, digits = 1): string {
  if (points == null || !Number.isFinite(points)) return "—";
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(digits)} pp`;
}

/** Index value (100-based growth): 196.6 -> "196.6". */
export function indexValue(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function signClass(
  ratio: number | null | undefined,
  opts: { neutral?: string } = {},
): string {
  if (ratio == null || !Number.isFinite(ratio) || ratio === 0) {
    return opts.neutral ?? "text-ink";
  }
  return ratio > 0 ? "text-gain" : "text-loss";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2023-01-06" -> "Jan 2023" */
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** "2023-01-06" -> "6 Jan 2023" */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Clock time in a given IANA timezone as "HH:MM:SS". */
export function clockIn(tz: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/** Short "as of" label, e.g. "14:32:05 ET". */
export function asOfLabel(iso: string | null, tz = "America/New_York", tzAbbr = "ET"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${clockIn(tz, d)} ${tzAbbr}`;
}

export function yearsBetween(startIso: string, end = new Date()): number {
  const start = new Date(startIso + "T00:00:00Z");
  const ms = end.getTime() - start.getTime();
  return ms / (365.25 * 24 * 3600 * 1000);
}
