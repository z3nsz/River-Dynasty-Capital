-- ===========================================================================
-- River Dynasty Capital — database schema
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Then run supabase/seed.sql to load the sample data.
-- ===========================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- updated_at trigger helper
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- sleeves — the portfolios under the one brand
-- --------------------------------------------------------------------------
create table if not exists public.sleeves (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  display_name       text not null,
  inception_date     date not null,
  -- Benchmark (SPY) closing price on the inception date. Lets us compute the
  -- benchmark return without a paid historical-price API.
  sp_inception_price numeric not null default 0,
  -- This sleeve's weight in the "Combined" view (the two are normalised).
  combined_weight    numeric not null default 0.5,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists sleeves_set_updated_at on public.sleeves;
create trigger sleeves_set_updated_at
  before update on public.sleeves
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- positions — one row per holding (open or closed)
-- NOTE: prices are stored ONLY to compute percentage returns. They are never
-- rendered as portfolio value, cost basis, cash, or share counts.
-- --------------------------------------------------------------------------
create table if not exists public.positions (
  id            uuid primary key default gen_random_uuid(),
  sleeve_id     uuid not null references public.sleeves(id) on delete cascade,
  ticker        text not null,
  company       text not null,
  entry_price   numeric not null,
  entry_date    date not null,
  weight_pct    numeric not null,
  current_price numeric,                       -- manual fallback / last known
  thesis        text not null default '',
  status        text not null default 'open' check (status in ('open', 'closed')),
  exit_price    numeric,
  exit_date     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists positions_sleeve_idx on public.positions (sleeve_id);
create index if not exists positions_status_idx on public.positions (status);

drop trigger if exists positions_set_updated_at on public.positions;
create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- snapshots — drives the indexed growth chart. Both indices start at 100 on
-- the inception date. sleeve_id NULL means the Combined view.
-- --------------------------------------------------------------------------
create table if not exists public.snapshots (
  id              uuid primary key default gen_random_uuid(),
  sleeve_id       uuid references public.sleeves(id) on delete cascade,
  date            date not null,
  portfolio_index numeric not null,
  sp_index        numeric not null,
  created_at      timestamptz not null default now()
);

-- One snapshot per sleeve per day. Postgres treats NULLs as distinct, so the
-- Combined (NULL sleeve_id) rows are constrained by a separate partial index.
create unique index if not exists snapshots_sleeve_date_idx
  on public.snapshots (sleeve_id, date)
  where sleeve_id is not null;
create unique index if not exists snapshots_combined_date_idx
  on public.snapshots (date)
  where sleeve_id is null;

-- --------------------------------------------------------------------------
-- price_cache — server-side quote cache. EVERY visitor reads this table.
-- The Finnhub API is only ever called by the server to refill this table.
-- --------------------------------------------------------------------------
create table if not exists public.price_cache (
  symbol      text primary key,
  price       numeric,
  prev_close  numeric,
  as_of       timestamptz,                     -- when the quote data is from
  recent      jsonb not null default '[]',     -- rolling [{t,p}] for sparklines
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- refresh_lock — single row; dedupes background cache refreshes so a burst of
-- visitors can only trigger one Finnhub refresh at a time.
-- --------------------------------------------------------------------------
create table if not exists public.refresh_lock (
  id         integer primary key default 1,
  locked_at  timestamptz not null default 'epoch',
  constraint refresh_lock_singleton check (id = 1)
);
insert into public.refresh_lock (id) values (1) on conflict (id) do nothing;

-- ===========================================================================
-- Row Level Security
-- Public (anon) role may READ the display tables only. All writes go through
-- the Next.js server using the service_role key, gated by the admin cookie.
-- ===========================================================================
alter table public.sleeves     enable row level security;
alter table public.positions   enable row level security;
alter table public.snapshots   enable row level security;
alter table public.price_cache enable row level security;
alter table public.refresh_lock enable row level security;

drop policy if exists "public read sleeves"     on public.sleeves;
drop policy if exists "public read positions"   on public.positions;
drop policy if exists "public read snapshots"   on public.snapshots;
drop policy if exists "public read price_cache" on public.price_cache;

create policy "public read sleeves"     on public.sleeves     for select using (true);
create policy "public read positions"   on public.positions   for select using (true);
create policy "public read snapshots"   on public.snapshots   for select using (true);
create policy "public read price_cache" on public.price_cache for select using (true);
-- refresh_lock: no policies => anon cannot see or touch it. service_role bypasses RLS.
