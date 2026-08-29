import { describe, it, expect } from "vitest";
import { getMarketStatus, isMarketOpen } from "@/lib/market";

// Helper: a specific instant. We pass explicit UTC and let the ET conversion run.
const at = (iso: string) => new Date(iso);

describe("getMarketStatus", () => {
  it("is OPEN on a weekday inside 09:30–16:00 ET", () => {
    // 2026-03-10 is a Tuesday. 15:00 UTC = 10:00 EST/EDT window.
    // In March after DST (2026-03-08), ET = UTC-4, so 15:00 UTC = 11:00 ET.
    const s = getMarketStatus(at("2026-03-10T15:00:00Z"));
    expect(s.status).toBe("open");
    expect(s.label).toMatch(/closes 16:00 ET/);
  });

  it("is CLOSED before the open on a weekday", () => {
    // 12:00 UTC = 08:00 ET in March -> pre-market
    const s = getMarketStatus(at("2026-03-10T12:00:00Z"));
    expect(s.status).toBe("closed");
    expect(s.reason).toBe("pre-market");
  });

  it("is CLOSED after 16:00 ET on a weekday", () => {
    // 22:00 UTC = 18:00 ET in March
    const s = getMarketStatus(at("2026-03-10T22:00:00Z"));
    expect(s.status).toBe("closed");
    expect(s.reason).toBe("after-hours");
  });

  it("is CLOSED on weekends", () => {
    // 2026-03-14 is a Saturday
    const s = getMarketStatus(at("2026-03-14T16:00:00Z"));
    expect(s.status).toBe("closed");
    expect(s.reason).toBe("weekend");
  });

  it("is CLOSED on a known holiday (Jan 1 2026)", () => {
    const s = getMarketStatus(at("2026-01-01T15:00:00Z"));
    expect(s.status).toBe("closed");
    expect(s.reason).toBe("holiday");
  });

  it("handles the winter UTC offset (EST = UTC-5)", () => {
    // 2026-01-05 Monday, 14:30 UTC = 09:30 EST exactly -> open
    const s = getMarketStatus(at("2026-01-05T14:30:00Z"));
    expect(s.status).toBe("open");
  });

  it("winter: 14:00 UTC = 09:00 EST -> still closed", () => {
    const s = getMarketStatus(at("2026-01-05T14:00:00Z"));
    expect(s.status).toBe("closed");
  });

  it("always reports a HH:MM:SS ET clock and ET timezone", () => {
    const s = getMarketStatus(at("2026-03-10T15:00:00Z"));
    expect(s.tz).toBe("ET");
    expect(s.nowET).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("points nextChangeAt at 09:30 ET when closed (Fri night -> Mon open)", () => {
    // 2026-08-28 is a Friday; 21:00 ET is after-hours.
    const s = getMarketStatus(at("2026-08-29T01:00:00Z"));
    expect(s.status).toBe("closed");
    const next = new Date(s.nextChangeAt!);
    // 09:30 ET in late August = 13:30 UTC (EDT, UTC-4)
    expect(next.getUTCHours()).toBe(13);
    expect(next.getUTCMinutes()).toBe(30);
    expect(next.getUTCDay()).toBe(1); // Monday
  });

  it("points nextChangeAt at 16:00 ET when open", () => {
    const s = getMarketStatus(at("2026-03-10T15:00:00Z"));
    const next = new Date(s.nextChangeAt!);
    // 16:00 ET in March after DST = 20:00 UTC
    expect(next.getUTCHours()).toBe(20);
  });

  it("isMarketOpen agrees with getMarketStatus", () => {
    const t = at("2026-03-10T15:00:00Z");
    expect(isMarketOpen(t)).toBe(getMarketStatus(t).status === "open");
  });
});
