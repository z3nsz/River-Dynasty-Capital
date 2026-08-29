"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pct, longDate } from "@/lib/format";
import { holdingReturn } from "@/lib/returns";
import type { Sleeve, Position, Snapshot, MarketStatus } from "@/lib/types";

/* ------------------------------------------------------------------ helpers */

async function api(
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "tnum w-full rounded-sm border border-hairline bg-paper px-2 py-1.5 text-sm";

/* --------------------------------------------------------------- dashboard */

export function AdminDashboard({
  sleeves,
  positions,
  snapshots,
  quotesAsOf,
  hasPriceApi,
  market,
}: {
  sleeves: Sleeve[];
  positions: Position[];
  snapshots: Snapshot[];
  quotesAsOf: string | null;
  hasPriceApi: boolean;
  market: MarketStatus;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const run = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okText: string,
  ) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r.ok) {
      flash("ok", okText);
      router.refresh();
    } else {
      flash("err", r.error || "failed");
    }
  };

  const bySleeve = useMemo(() => {
    const m = new Map<string, Position[]>();
    for (const s of sleeves) m.set(s.id, []);
    for (const p of positions) m.get(p.sleeve_id)?.push(p);
    return m;
  }, [sleeves, positions]);

  const lastSnapshot = snapshots
    .map((s) => s.date)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            River Dynasty Capital
          </h1>
          <p className="text-xs text-muted">Admin</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a href="/" className="rounded-sm border border-hairline px-2 py-1 hover:bg-ink/5">
            public site ↗
          </a>
          <button
            type="button"
            onClick={() =>
              run("logout", () => api("/api/admin/logout", "POST"), "signed out").then(
                () => router.replace("/admin/login"),
              )
            }
            className="rounded-sm border border-hairline px-2 py-1 hover:bg-ink/5"
          >
            sign out
          </button>
        </div>
      </header>

      {msg && (
        <div
          className={`mt-4 rounded-sm px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-gain/10 text-gain"
              : "bg-loss/10 text-loss"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* actions */}
      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-hairline p-4 text-sm">
        <div className="text-xs text-muted">
          <div>
            Market: <span className="tnum">{market.status.toUpperCase()}</span> ·{" "}
            {market.label}
          </div>
          <div className="tnum">
            Prices as of: {quotesAsOf ? new Date(quotesAsOf).toISOString() : "never"}
          </div>
          <div className="tnum">
            Last snapshot: {lastSnapshot ?? "none"}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={!hasPriceApi || busy === "refresh"}
            onClick={() =>
              run(
                "refresh",
                () => api("/api/admin/refresh-prices", "POST"),
                "prices refreshed",
              )
            }
            className="rounded-sm bg-navy px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
            title={hasPriceApi ? "" : "No FINNHUB_API_KEY set"}
          >
            {busy === "refresh" ? "refreshing…" : "Refresh prices"}
          </button>
          <button
            type="button"
            disabled={busy === "snapshot"}
            onClick={() =>
              run(
                "snapshot",
                () => api("/api/admin/snapshot", "POST"),
                "snapshot logged",
              )
            }
            className="rounded-sm border border-navy px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-50"
          >
            {busy === "snapshot" ? "logging…" : "Log snapshot"}
          </button>
        </div>
      </section>

      {/* sleeves */}
      <section className="mt-8">
        <h2 className="font-display text-lg">Sleeves</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {sleeves.map((s) => (
            <SleeveEditor
              key={s.id}
              sleeve={s}
              busy={busy === `sleeve-${s.id}`}
              onSave={(patch) =>
                run(
                  `sleeve-${s.id}`,
                  () => api(`/api/admin/sleeves/${s.id}`, "PATCH", patch),
                  "sleeve saved",
                )
              }
            />
          ))}
        </div>
      </section>

      {/* positions */}
      <section className="mt-10">
        <h2 className="font-display text-lg">Positions</h2>
        {sleeves.map((s) => (
          <div key={s.id} className="mt-4">
            <h3 className="tnum text-sm font-semibold text-muted">
              {s.display_name}
            </h3>
            <div className="mt-2 space-y-2">
              {(bySleeve.get(s.id) ?? [])
                .filter((p) => p.status === "open")
                .map((p) => (
                  <PositionEditor
                    key={p.id}
                    position={p}
                    busy={busy === `pos-${p.id}`}
                    onSave={(patch) =>
                      run(
                        `pos-${p.id}`,
                        () => api(`/api/admin/positions/${p.id}`, "PATCH", patch),
                        "position saved",
                      )
                    }
                    onClose={(exit) =>
                      run(
                        `pos-${p.id}`,
                        () =>
                          api(`/api/admin/positions/${p.id}/close`, "POST", exit),
                        "position closed",
                      )
                    }
                    onDelete={() =>
                      run(
                        `pos-${p.id}`,
                        () => api(`/api/admin/positions/${p.id}`, "DELETE"),
                        "position deleted",
                      )
                    }
                  />
                ))}
              {(bySleeve.get(s.id) ?? []).filter((p) => p.status === "open")
                .length === 0 && (
                <p className="text-xs text-muted">No open positions.</p>
              )}

              {(bySleeve.get(s.id) ?? []).filter((p) => p.status === "closed")
                .length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted">
                    Closed positions
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {(bySleeve.get(s.id) ?? [])
                      .filter((p) => p.status === "closed")
                      .map((p) => (
                        <li key={p.id} className="tnum">
                          {p.ticker} · held {longDate(p.entry_date)} →{" "}
                          {p.exit_date ? longDate(p.exit_date) : "—"} ·{" "}
                          {pct(holdingReturn(p.entry_price, p.exit_price))}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* add position */}
      <section className="mt-10">
        <h2 className="font-display text-lg">Add a position</h2>
        <AddPositionForm
          sleeves={sleeves}
          hasPriceApi={hasPriceApi}
          busy={busy === "add"}
          onAdd={(body) =>
            run("add", () => api("/api/admin/positions", "POST", body), "position added")
          }
        />
      </section>

      <p className="mt-12 text-xs text-muted">
        Prices are per-share quotes used only to compute percentage returns. The
        public site never shows any monetary amount.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- sleeve editor */

function SleeveEditor({
  sleeve,
  onSave,
  busy,
}: {
  sleeve: Sleeve;
  onSave: (patch: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(sleeve.display_name);
  const [inception, setInception] = useState(sleeve.inception_date);
  const [spPrice, setSpPrice] = useState(String(sleeve.sp_inception_price));
  const [cw, setCw] = useState(String(sleeve.combined_weight));

  return (
    <div className="rounded-sm border border-hairline p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Display name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Inception date">
          <input
            type="date"
            className={inputCls}
            value={inception}
            onChange={(e) => setInception(e.target.value)}
          />
        </Field>
        <Field label="S&P price at inception">
          <input
            className={inputCls}
            value={spPrice}
            onChange={(e) => setSpPrice(e.target.value)}
          />
        </Field>
        <Field label="Combined weight (0–1)">
          <input
            className={inputCls}
            value={cw}
            onChange={(e) => setCw(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onSave({
            display_name: name,
            inception_date: inception,
            sp_inception_price: Number(spPrice),
            combined_weight: Number(cw),
          })
        }
        className="mt-3 rounded-sm bg-navy px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
      >
        {busy ? "saving…" : "Save sleeve"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------- position editor */

function PositionEditor({
  position,
  onSave,
  onClose,
  onDelete,
  busy,
}: {
  position: Position;
  onSave: (patch: Record<string, unknown>) => void;
  onClose: (exit: { exit_price: number; exit_date: string }) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [weight, setWeight] = useState(String(position.weight_pct));
  const [entry, setEntry] = useState(String(position.entry_price));
  const [current, setCurrent] = useState(
    position.current_price == null ? "" : String(position.current_price),
  );
  const [thesis, setThesis] = useState(position.thesis);
  const [showClose, setShowClose] = useState(false);
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));

  const ret = holdingReturn(
    Number(entry),
    current === "" ? null : Number(current),
  );

  return (
    <div className="rounded-sm border border-hairline p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="tnum text-sm font-semibold">
          {position.ticker}{" "}
          <span className="font-normal text-muted">{position.company}</span>
        </div>
        <div className="tnum text-sm">{pct(ret)}</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Weight %">
          <input
            className={inputCls}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Entry price">
          <input
            className={inputCls}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </Field>
        <Field label="Current price (manual)">
          <input
            className={inputCls}
            value={current}
            placeholder="auto"
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Entry date">
          <span className="tnum text-sm">{position.entry_date}</span>
        </Field>
      </div>

      <Field label="Thesis">
        <textarea
          className={`${inputCls} min-h-[3rem]`}
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
        />
      </Field>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              weight_pct: Number(weight),
              entry_price: Number(entry),
              current_price: current === "" ? null : Number(current),
              thesis,
            })
          }
          className="rounded-sm bg-navy px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
        >
          {busy ? "saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setShowClose((v) => !v)}
          className="rounded-sm border border-hairline px-3 py-1.5 text-xs hover:bg-ink/5"
        >
          Sell / close
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete ${position.ticker}? This cannot be undone.`)) {
              onDelete();
            }
          }}
          className="rounded-sm border border-loss px-3 py-1.5 text-xs text-loss hover:bg-loss/5"
        >
          Delete
        </button>
      </div>

      {showClose && (
        <div className="mt-3 rounded-sm bg-ink/5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Exit price">
              <input
                className={inputCls}
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </Field>
            <Field label="Exit date">
              <input
                type="date"
                className={inputCls}
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={busy || !exitPrice}
            onClick={() =>
              onClose({ exit_price: Number(exitPrice), exit_date: exitDate })
            }
            className="mt-2 rounded-sm bg-loss px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
          >
            Confirm close
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- add position */

function AddPositionForm({
  sleeves,
  hasPriceApi,
  onAdd,
  busy,
}: {
  sleeves: Sleeve[];
  hasPriceApi: boolean;
  onAdd: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [f, setF] = useState({
    sleeve_id: sleeves[0]?.id ?? "",
    ticker: "",
    company: "",
    entry_price: "",
    entry_date: new Date().toISOString().slice(0, 10),
    weight_pct: "",
    current_price: "",
    thesis: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const valid =
    f.sleeve_id && f.ticker && f.company && f.entry_price && f.entry_date && f.weight_pct;

  return (
    <div className="mt-3 rounded-sm border border-hairline p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sleeve">
          <select
            className={inputCls}
            value={f.sleeve_id}
            onChange={(e) => set("sleeve_id", e.target.value)}
          >
            {sleeves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ticker">
          <input
            className={inputCls}
            value={f.ticker}
            onChange={(e) => set("ticker", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Company">
          <input
            className={inputCls}
            value={f.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </Field>
        <Field label="Entry price">
          <input
            className={inputCls}
            value={f.entry_price}
            onChange={(e) => set("entry_price", e.target.value)}
          />
        </Field>
        <Field label="Entry date">
          <input
            type="date"
            className={inputCls}
            value={f.entry_date}
            onChange={(e) => set("entry_date", e.target.value)}
          />
        </Field>
        <Field label="Target weight %">
          <input
            className={inputCls}
            value={f.weight_pct}
            onChange={(e) => set("weight_pct", e.target.value)}
          />
        </Field>
        <Field
          label={`Current price ${hasPriceApi ? "(blank = auto-fetch)" : "(manual)"}`}
        >
          <input
            className={inputCls}
            value={f.current_price}
            placeholder={hasPriceApi ? "auto" : "required without API key"}
            onChange={(e) => set("current_price", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Thesis">
        <textarea
          className={`${inputCls} mt-1 min-h-[4rem]`}
          value={f.thesis}
          onChange={(e) => set("thesis", e.target.value)}
        />
      </Field>
      <button
        type="button"
        disabled={busy || !valid}
        onClick={() =>
          onAdd({
            ...f,
            entry_price: Number(f.entry_price),
            weight_pct: Number(f.weight_pct),
            current_price: f.current_price === "" ? null : Number(f.current_price),
          })
        }
        className="mt-3 rounded-sm bg-navy px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
      >
        {busy ? "adding…" : "Add position"}
      </button>
    </div>
  );
}
