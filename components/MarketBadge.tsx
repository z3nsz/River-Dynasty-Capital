"use client";

import { useEffect, useState } from "react";
import { useLivePrices } from "./LivePricesProvider";
import { clockIn } from "@/lib/format";

/**
 * OPEN / CLOSED market badge plus an unambiguous "as of" line. Timezones are
 * spelled out (ET for the market, plus the viewer's own zone) because the US
 * session happens overnight for anyone on Asia time.
 */
export function MarketBadge() {
  const { market, asOf, degraded, source, refresh } = useLivePrices();
  const [nowET, setNowET] = useState<string>(market.nowET);
  const [nowLocal, setNowLocal] = useState<string>("");

  const localZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "local";

  useEffect(() => {
    const tick = () => {
      setNowET(clockIn("America/New_York"));
      setNowLocal(clockIn(localZone));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [localZone]);

  const open = market.status === "open";
  const asOfClock = asOf ? clockIn("America/New_York", new Date(asOf)) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span
        className={`tnum inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-medium ${
          open ? "bg-gain/10 text-gain" : "bg-ink/5 text-muted"
        }`}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            open ? "bg-gain" : "bg-muted"
          }`}
          aria-hidden
        />
        {open ? "MARKET OPEN" : "MARKET CLOSED"}
      </span>

      <span>{market.label}</span>

      <span className="tnum">
        Now {nowET} ET
        {nowLocal && localZone !== "America/New_York" ? (
          <> · {nowLocal} {shortZone(localZone)}</>
        ) : null}
      </span>

      {asOfClock ? (
        <span className="tnum">
          {open ? "Prices as of" : "Last close"} {asOfClock} ET
        </span>
      ) : (
        <span>Prices: none yet</span>
      )}

      {source === "manual" && <span className="text-loss">manual prices</span>}
      {degraded && <span className="text-loss">reconnecting…</span>}

      <button
        type="button"
        onClick={refresh}
        className="rounded-sm border border-hairline px-1.5 py-0.5 hover:bg-ink/5"
      >
        refresh
      </button>
    </div>
  );
}

function shortZone(zone: string): string {
  const parts = zone.split("/");
  return (parts[parts.length - 1] || zone).replace(/_/g, " ");
}
