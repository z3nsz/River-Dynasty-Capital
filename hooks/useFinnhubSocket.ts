"use client";

import { useEffect, useRef } from "react";

/**
 * Optional real-time price ticking via Finnhub's trade websocket.
 *
 * Enabled only when NEXT_PUBLIC_FINNHUB_TOKEN is set (see README — that token is
 * public, so use a separate key). Active only while `enabled` (US market open).
 * On any socket error / close it simply stops; the 60s REST polling in
 * LivePricesProvider keeps running regardless, so this is pure upside.
 *
 * Limits: US symbols only on the free tier, ~50 symbol subscriptions, and some
 * symbols (certain ETFs / class shares) never send trades — those just keep
 * their polled value.
 */
export function useFinnhubSocket(
  symbols: string[],
  enabled: boolean,
  onTrade: (symbol: string, price: number) => void,
) {
  const cbRef = useRef(onTrade);
  cbRef.current = onTrade;

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_FINNHUB_TOKEN;
    if (!token || !enabled || symbols.length === 0) return;
    if (typeof window === "undefined" || !("WebSocket" in window)) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);

      ws.onopen = () => {
        for (const s of symbols.slice(0, 45)) {
          ws?.send(JSON.stringify({ type: "subscribe", symbol: s }));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type !== "trade" || !Array.isArray(msg.data)) return;
          // last trade per symbol in this batch
          const latest = new Map<string, number>();
          for (const t of msg.data) {
            if (t && typeof t.s === "string" && typeof t.p === "number") {
              latest.set(t.s, t.p);
            }
          }
          for (const [s, p] of latest) cbRef.current(s.toUpperCase(), p);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (closed) return;
        retry = setTimeout(connect, 15_000); // back off, polling covers the gap
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      try {
        for (const s of symbols) {
          ws?.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
        }
      } catch {
        /* socket already gone */
      }
      ws?.close();
    };
  }, [symbols, enabled]);
}
