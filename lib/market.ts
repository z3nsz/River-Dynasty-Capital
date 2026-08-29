/**
 * US equity market hours, timezone-independent.
 *
 * Regular NYSE/Nasdaq session: 09:30–16:00 America/New_York, Monday–Friday,
 * excluding full-day holidays. Early-close half-days (e.g. the day after
 * Thanksgiving) are treated as normal full days here — acceptable for a
 * track-record site; the "As of" timestamp still tells the true story.
 */

import type { MarketStatus } from "./types";

const OPEN_MIN = 9 * 60 + 30; // 570
const CLOSE_MIN = 16 * 60; // 960

// Full-day closures (America/New_York local dates). Extend yearly.
const HOLIDAYS = new Set<string>([
  // 2024
  "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29", "2024-05-27",
  "2024-06-19", "2024-07-04", "2024-09-02", "2024-11-28", "2024-12-25",
  // 2025
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18",
  "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27",
  "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

interface EtParts {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0 = Sunday
  minutes: number; // minutes since ET midnight
  dateKey: string; // "YYYY-MM-DD"
  hms: string; // "HH:MM:SS"
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function etParts(date: Date): EtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0; // some environments emit "24" at midnight
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const weekday = WEEKDAYS.indexOf(parts.weekday);

  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hms = `${String(hour).padStart(2, "0")}:${parts.minute}:${parts.second}`;

  return {
    year,
    month,
    day,
    weekday,
    minutes: hour * 60 + minute + second / 60,
    dateKey,
    hms,
  };
}

function isTradingDay(p: { weekday: number; dateKey: string }): boolean {
  if (p.weekday === 0 || p.weekday === 6) return false;
  if (HOLIDAYS.has(p.dateKey)) return false;
  return true;
}

/**
 * Find the next session open at or after `from`, scanning day by day (max ~10
 * days to skip long holiday weekends). Returns an ET wall-clock description.
 */
function nextOpen(from: Date): { at: Date; label: string } | null {
  for (let i = 0; i < 12; i++) {
    const probe = new Date(from.getTime() + i * 24 * 3600 * 1000);
    const p = etParts(probe);
    if (!isTradingDay(p)) continue;
    if (i === 0 && p.minutes >= OPEN_MIN) continue; // already past today's open
    // Build an ISO-ish instant for 09:30 ET that day. We approximate by taking
    // the probe date's ET calendar day and asking for 13:30 or 14:30 UTC; to
    // stay correct across DST we instead just report the label and a coarse
    // timestamp (top of the ET day + 9.5h) which is close enough for a badge.
    const dayStartUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
    // ET wall-clock T => UTC = T + offset (ET is behind UTC).
    const offsetMin = etOffsetMinutes(probe);
    const at = new Date(dayStartUtc + (OPEN_MIN + offsetMin) * 60000);
    const dayLabel = i === 0 ? "today" : i === 1 ? "tomorrow" : WEEKDAYS[p.weekday];
    return { at, label: `opens ${dayLabel} 09:30 ET` };
  }
  return null;
}

function todayClose(from: Date): Date {
  const p = etParts(from);
  const dayStartUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  const offsetMin = etOffsetMinutes(from);
  return new Date(dayStartUtc + (CLOSE_MIN + offsetMin) * 60000);
}

/** Minutes that America/New_York is behind UTC at `date` (300 in winter, 240 in summer). */
function etOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  });
  const tzName = fmt.formatToParts(date).find((p) => p.type === "timeZoneName")?.value;
  // e.g. "GMT-4" or "GMT-5"
  const m = tzName?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 300;
  const hours = Number(m[1]);
  const mins = Number(m[2] || 0);
  return -(hours * 60 + Math.sign(hours) * mins);
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const p = etParts(now);
  const base: Pick<MarketStatus, "tz" | "nowET"> = { tz: "ET", nowET: p.hms };

  if (!isTradingDay(p)) {
    const reason: MarketStatus["reason"] = HOLIDAYS.has(p.dateKey)
      ? "holiday"
      : "weekend";
    const next = nextOpen(now);
    return {
      ...base,
      status: "closed",
      reason,
      label: `Closed (${reason}) · ${next?.label ?? "opens 09:30 ET"}`,
      nextChangeAt: next?.at.toISOString() ?? null,
    };
  }

  if (p.minutes < OPEN_MIN) {
    const next = nextOpen(now);
    return {
      ...base,
      status: "closed",
      reason: "pre-market",
      label: `Closed · opens today 09:30 ET`,
      nextChangeAt: next?.at.toISOString() ?? null,
    };
  }

  if (p.minutes >= CLOSE_MIN) {
    const next = nextOpen(now);
    return {
      ...base,
      status: "closed",
      reason: "after-hours",
      label: `Closed · ${next?.label ?? "opens 09:30 ET"}`,
      nextChangeAt: next?.at.toISOString() ?? null,
    };
  }

  return {
    ...base,
    status: "open",
    reason: null,
    label: `Open · closes 16:00 ET`,
    nextChangeAt: todayClose(now).toISOString(),
  };
}

export function isMarketOpen(now: Date = new Date()): boolean {
  return getMarketStatus(now).status === "open";
}
