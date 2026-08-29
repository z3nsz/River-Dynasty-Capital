# River Dynasty Capital

A public, deployable **personal investment track record**. It shows one
portfolio's performance versus the S&P 500, holding by holding, with a written
thesis for each position — and a private admin panel for maintaining it.

- **Public view** — read-only, anyone can see it.
- **Admin panel** at `/admin` — password-gated; add / edit / close positions,
  refresh prices, log snapshots.

### The one hard rule

**No dollar amounts, anywhere.** No portfolio value, cost basis, cash, or share
counts — on the public site or in the admin panel. Everything is expressed as
percentages (weights, returns) and index values (a growth curve that starts at
100 at inception). Entry and current *prices* live in the database only to
compute percentage returns; they are never shown as money.

---

## What it looks like

- **Masthead** — wordmark, tagline, and the fund name ("Seine's Fund") with its
  inception date.
- **Headline stats** — total return since inception, annualized CAGR, S&P 500
  return over the same period, and excess return vs the benchmark (in points).
- **Indexed growth chart** — portfolio (solid) vs S&P 500 (dashed), both indexed
  to 100, ending values labelled, with **5D / 1M / 3M / 6M / YTD / 1Y / 5Y / All**
  timeframe buttons (shorter ranges re-base to 100 at the window start).
- **Holdings** — one row per open position: ticker, company, price sparkline,
  return %, weight bar, thesis. Sortable by weight / return / ticker.
- **Realized / closed** — sold positions with entry date, exit date, realized %.
- A market **OPEN / CLOSED** badge with an unambiguous "as of HH:MM:SS ET"
  timestamp (plus your local time — the US session is overnight in Asia).

---

## The fund

One portfolio, **Seine's Fund** (slug `seine`). Its display name, inception
date, and the S&P 500 price at inception are editable in the admin panel under
**Fund**.

(The `sleeves` table still allows multiple rows if you ever want to add a second
portfolio — the app just renders the first one today.)

---

## Tech

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (free Postgres) — public reads via RLS, all writes server-side
- **Finnhub** free tier for quotes (optional — falls back to manual prices)
- Charts are hand-rolled inline SVG (no chart library; ~111 kB first load)
- Deploys to **Vercel** (free, gives you a public URL)

---

## Setup — step by step

You'll need free accounts on **Supabase**, **Finnhub** (optional), and
**Vercel**. No prior experience with any of them required.

### 1. Get the code running locally

```bash
# from the project folder
npm install
```

Node 18.18+ is required (this project was built and tested on Node 26).

### 2. Create the Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a name and a database
   password (you won't need the password again for this app). Wait ~2 minutes
   for it to provision.
2. In the project, open **SQL Editor** → **New query**. Paste the entire
   contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. New query again. Paste [`supabase/seed.sql`](supabase/seed.sql) and **Run**.
   This loads the sample fund, positions, and inception snapshot so the site
   renders immediately.
4. Open **Project Settings → API**. You need three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY`
     (this one is powerful — it's server-only and never sent to the browser)

### 3. Get a Finnhub API key (optional but recommended)

1. Sign up at <https://finnhub.io> → the dashboard shows your **API key**.
2. That's `FINNHUB_API_KEY`.

Without a key the site still works — you just type each holding's current price
in the admin panel by hand, and returns compute from that.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret |
| `FINNHUB_API_KEY` | Finnhub dashboard (leave blank to use manual prices) |
| `ADMIN_PASSWORD` | You choose it. This is the `/admin` login. |
| `AUTH_SECRET` | Run `openssl rand -hex 32` and paste the output |
| `CRON_SECRET` | Run `openssl rand -hex 16` (used for the price-refresh endpoint) |

> The repo ships a `.env.local` with the Finnhub key and generated
> `ADMIN_PASSWORD` / `AUTH_SECRET` / `CRON_SECRET` already filled in — you only
> need to add the three Supabase values.

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000> — the public site.
Open <http://localhost:3000/admin> — log in with `ADMIN_PASSWORD`.

In the admin panel click **Refresh prices** once to pull live quotes. Optionally,
under **Performance history**, enter a few past monthly return figures to seed
the growth chart — from then on the daily cron records new points automatically.

---

## Deploy to Vercel

1. Push this repo to GitHub (it already has a remote).
   ```bash
   git add -A && git commit -m "River Dynasty Capital" && git push
   ```
2. Go to <https://vercel.com> → **Add New… → Project** → import the GitHub repo.
3. Before the first deploy, add **Environment Variables** (same names as
   `.env.local`): all the Supabase values, `FINNHUB_API_KEY`, `ADMIN_PASSWORD`,
   `AUTH_SECRET`, `CRON_SECRET`, and `NEXT_PUBLIC_BENCHMARK_SYMBOL=SPY`.
4. **Deploy.** You get a public URL like `https://river-dynasty-capital.vercel.app`.

That URL is the public track record. `/admin` on the same URL is your panel.

---

## Live pricing — how it actually works (and its limits)

**Free stock APIs are not truly real-time.** Genuine tick-by-tick data is gated
and paid. Finnhub's free tier gives you US quotes that are real-time to
~15-minutes-delayed depending on the symbol and venue. **That is fine for a
track-record site** — what matters is that numbers update automatically and are
clearly timestamped, which they are ("as of HH:MM:SS ET").

### Architecture — never per-visitor

The Finnhub API is **only ever called by the server**, to refill a
`price_cache` table in Supabase. Every visitor reads that one cached snapshot.
The cache is refilled:

1. **On demand, when stale.** When someone loads the page and the cache is older
   than `PRICE_CACHE_TTL_SECONDS` (default 120) *and* the US market is open, the
   server refreshes it. A database lock means a burst of 100 visitors still
   triggers **one** Finnhub refresh, not 100. All ~12 tickers are fetched per
   refresh, with retry/back-off on rate limits.
2. **On a schedule** — see below.
3. **Manually** — the admin **Refresh prices** button.

### Scheduling the refresh

The scheduled refresh runs **once per weekday**, at 21:00 UTC — shortly after the
US market close — to capture the closing prices. This works on Vercel's free
Hobby plan (whose crons run about once a day anyway).

`vercel.json` defines this cron on `/api/cron/refresh`. There is also an optional
**GitHub Action** ([`.github/workflows/refresh.yml`](.github/workflows/refresh.yml))
that does the same daily ping — useful as a backstop, or if you prefer to run the
schedule from GitHub. To enable it, add two repository secrets (**Settings →
Secrets and variables → Actions**):

- `REFRESH_URL` = `https://YOUR-APP.vercel.app/api/cron/refresh`
- `CRON_SECRET` = the same value you put in Vercel's env vars

Intraday freshness comes from the **on-demand refresh** (#1 above): while the
market is open, a page view older than `PRICE_CACHE_TTL_SECONDS` triggers one
server-side refresh (lock-deduped, never per-visitor). If you want a tighter
scheduled cadence during market hours and you're on Vercel **Pro**, change the
`vercel.json` schedule to e.g. `*/5 13-21 * * 1-5`.

### While a page is open

The page polls `/api/prices` every **60 seconds** while the US market is open,
updating holding prices, returns, headline stats, and the "as of" time **in
place** — no reload. Changed numbers get a brief tasteful flash (disabled under
`prefers-reduced-motion`). When the market is **closed** the page stops polling
entirely (it shows the last close) and only re-checks the clock locally, so it
wakes up on its own at the next open.

### Optional: real-time websocket ticking

Set `NEXT_PUBLIC_FINNHUB_TOKEN` to enable live price ticks via Finnhub's trade
websocket while the US market is open. **This token is sent to the browser and
is therefore public** — use a *separate* Finnhub key here, not your main one.
Limits: US symbols only, ~50 symbol cap on the free tier, and some ETFs/class
shares never emit trades. It degrades cleanly to the 60-second polling if the
socket drops. Leave it blank and polling alone is perfectly fine.

### The growth chart & performance history

The chart is driven by the `snapshots` table — one row per day:
`{ date, portfolio_index, sp_index }`, both indexed to 100 at inception. It does
**not** tick intraday; only the current live point moves with prices.

**Recording is automatic.** The daily cron (see above) writes a snapshot after
each US trading day, so the history accumulates with no manual work. You can
also hit **Snapshot today from live prices** in the admin panel anytime.

**Importing an existing track record.** Finnhub's free tier has no historical
price endpoint, so the past can't be reconstructed from prices. Instead, in the
admin panel under **Performance history**, enter the fund's and the S&P 500's
*total return since inception* (in %) as of any past date — monthly points are
plenty. Re-entering a date overwrites it. (`scripts/backfill-snapshots.ts` is a
stub for if you later add a data source that does have daily history.)

**Timeframe selector.** The chart has **5D / 1M / 3M / 6M / YTD / 1Y / 5Y / All**
buttons. Any range shorter than "All" is **re-based to 100 at the start of that
window**, so you read the period's move directly off the axis; the legend shows
the period return for the fund and the benchmark. Windows with too few recorded
points yet fall back to showing all history, clearly labelled.

---

## Returns math

```
holding return   = (current price − entry price) / entry price
fund return      = Σ( weightᵢ / Σweight × holding returnᵢ )   over open positions
CAGR             = (1 + total return) ^ (365.25 / days since inception) − 1
benchmark return = SPY current / SPY price on inception date − 1
excess (points)  = (fund return − benchmark return) × 100
```

The SPY price on the inception date is stored in `sleeves.sp_inception_price` —
that's how the benchmark is computed without a paid history API.

---

## Admin auth

A single `ADMIN_PASSWORD` (env var). Logging in sets a signed, HTTP-only cookie
(HMAC-SHA256 with `AUTH_SECRET`, 7-day expiry). `middleware.ts` gates every
`/admin` page and `/api/admin/*` route. This was chosen over Supabase Auth
because it's a single-user panel — no user table, no RLS policies to reason
about, no email flows. To "rotate" access, change `AUTH_SECRET` (invalidates all
sessions) and/or `ADMIN_PASSWORD`.

---

## Project layout

```
app/
  page.tsx                 public site (server component)
  admin/                   login page + dashboard
  api/
    prices/                public cached-quotes endpoint (polled by the page)
    cron/refresh/          daily job: refresh prices + record a snapshot (CRON_SECRET)
    admin/                  password-gated write endpoints (incl. snapshots/)
components/                masthead, chart (timeframe selector), holdings, admin UI
lib/
  returns.ts               pure return math  (unit-tested)
  market.ts                US market-hours logic  (unit-tested)
  sleeveMetrics.ts         isomorphic derived-metrics (server + client agree)
  prices.ts                server-side price cache + refresh + lock
  snapshots.ts             records the daily performance-history point
  finnhub.ts               quote fetching with retry/back-off
  data.ts                  Supabase reads + fund selection
  auth.ts                  signed-cookie session
supabase/
  schema.sql               tables, RLS, indexes  ← run first
  seed.sql                 sample data           ← run second
tests/                     vitest: returns + market hours
```

## Commands

```bash
npm run dev      # local dev server on :3000
npm run build    # production build
npm start        # run the production build
npm test         # vitest (returns + market-hours units)
```
