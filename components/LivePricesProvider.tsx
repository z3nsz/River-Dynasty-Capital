"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CLIENT_POLL_MS } from "@/lib/config";
import { getMarketStatus } from "@/lib/market";
import { useFinnhubSocket } from "@/hooks/useFinnhubSocket";
import type { MarketStatus, PricesResponse, QuoteMap } from "@/lib/types";

interface LiveState {
  quotes: QuoteMap;
  asOf: string | null;
  fetchedAt: string | null;
  market: MarketStatus;
  source: PricesResponse["source"];
  /** true when the last poll failed and we're serving the previous data. */
  degraded: boolean;
  /** symbols whose price changed on the most recent update (drives the flash). */
  changed: Record<string, "up" | "down">;
  /** manual refresh trigger */
  refresh: () => void;
}

const LiveCtx = createContext<LiveState | null>(null);

export function useLivePrices(): LiveState {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLivePrices must be used inside <LivePricesProvider>");
  return ctx;
}

export function LivePricesProvider({
  initialQuotes,
  initialAsOf,
  initialMarket,
  initialSource,
  children,
}: {
  initialQuotes: QuoteMap;
  initialAsOf: string | null;
  initialMarket: MarketStatus;
  initialSource: PricesResponse["source"];
  children: React.ReactNode;
}) {
  const [quotes, setQuotes] = useState<QuoteMap>(initialQuotes);
  const [asOf, setAsOf] = useState<string | null>(initialAsOf);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketStatus>(initialMarket);
  const [source, setSource] = useState<PricesResponse["source"]>(initialSource);
  const [degraded, setDegraded] = useState(false);
  const [changed, setChanged] = useState<Record<string, "up" | "down">>({});

  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`prices ${res.status}`);
      const data = (await res.json()) as PricesResponse;

      const prev = quotesRef.current;
      const delta: Record<string, "up" | "down"> = {};
      for (const [sym, q] of Object.entries(data.quotes)) {
        const before = prev[sym]?.price;
        if (before != null && q.price !== before) {
          delta[sym] = q.price > before ? "up" : "down";
        }
      }

      setQuotes(data.quotes);
      setAsOf(data.asOf);
      setFetchedAt(data.fetchedAt);
      setMarket(data.market);
      setSource(data.source);
      setDegraded(false);
      setChanged(delta);
      if (Object.keys(delta).length) {
        // clear the flash markers after the animation
        setTimeout(() => setChanged({}), 1000);
      }
    } catch {
      setDegraded(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Network polling only while the US market is open. When closed we just
  // re-evaluate the clock locally (no network) and resume when it opens.
  useEffect(() => {
    let priceTimer: ReturnType<typeof setInterval> | null = null;
    let clockTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (priceTimer) return;
      poll();
      priceTimer = setInterval(poll, CLIENT_POLL_MS);
    };
    const stopPolling = () => {
      if (priceTimer) clearInterval(priceTimer);
      priceTimer = null;
    };

    const evaluate = () => {
      const status = getMarketStatus();
      setMarket(status);
      if (status.status === "open") startPolling();
      else stopPolling();
    };

    evaluate();
    clockTimer = setInterval(evaluate, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPolling();
      if (clockTimer) clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  // Optional real-time ticking (no-op unless NEXT_PUBLIC_FINNHUB_TOKEN is set).
  const symbols = useMemo(() => Object.keys(quotes), [quotes]);
  const onTrade = useCallback((symbol: string, price: number) => {
    setQuotes((prev) => {
      const q = prev[symbol];
      if (!q || q.price === price) return prev;
      const dir: "up" | "down" = price > q.price ? "up" : "down";
      setChanged((c) => ({ ...c, [symbol]: dir }));
      setTimeout(
        () =>
          setChanged((c) => {
            const { [symbol]: _drop, ...rest } = c;
            return rest;
          }),
        1000,
      );
      return {
        ...prev,
        [symbol]: {
          ...q,
          price,
          changePct: q.prevClose > 0 ? ((price - q.prevClose) / q.prevClose) * 100 : 0,
        },
      };
    });
  }, []);
  useFinnhubSocket(symbols, market.status === "open", onTrade);

  const value = useMemo<LiveState>(
    () => ({
      quotes,
      asOf,
      fetchedAt,
      market,
      source,
      degraded,
      changed,
      refresh: poll,
    }),
    [quotes, asOf, fetchedAt, market, source, degraded, changed, poll],
  );

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
