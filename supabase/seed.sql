-- ===========================================================================
-- River Dynasty Capital — sample seed data
-- Run this AFTER schema.sql, in the Supabase SQL Editor.
-- Safe to re-run: it clears the sample rows first.
-- Replace this data from the /admin panel once you are up and running.
-- ===========================================================================

begin;

delete from public.snapshots;
delete from public.positions;
delete from public.price_cache;
delete from public.sleeves;

-- --------------------------------------------------------------------------
-- Sleeves. Inception 2023-01-03. SPY closed at 380.82 that day.
-- --------------------------------------------------------------------------
insert into public.sleeves (slug, display_name, inception_date, sp_inception_price, combined_weight, sort_order)
values
  ('seine',       'Seine',        date '2023-01-03', 380.82, 0.5, 1),
  ('portfolio-2', 'Portfolio II', date '2023-01-03', 380.82, 0.5, 2);

-- --------------------------------------------------------------------------
-- Seine positions
-- --------------------------------------------------------------------------
insert into public.positions (sleeve_id, ticker, company, entry_price, entry_date, weight_pct, current_price, thesis, status)
select id, v.ticker, v.company, v.entry_price, v.entry_date, v.weight_pct, v.current_price, v.thesis, 'open'
from public.sleeves s
cross join (values
  ('NVDA',  'NVIDIA Corp.',        48.00,  date '2023-01-06', 22, 172.80,
   'Accelerated computing as the default AI architecture; CUDA moat. Top conviction, trimmed on the way up.'),
  ('COST',  'Costco Wholesale',    500.00, date '2023-01-06', 20, 900.00,
   'Membership renewals above 90% — a subscription hiding inside a retailer. Long reinvestment runway.'),
  ('BRK.B', 'Berkshire Hathaway',  300.00, date '2023-01-06', 18, 465.00,
   'Ballast. Quality operating businesses plus cash that turns panics into opportunity.'),
  ('V',     'Visa Inc.',           220.00, date '2023-01-06', 16, 319.00,
   'Toll road on global consumption, roughly 60% margins. Kept moderate on interchange-regulation risk.'),
  ('ASML',  'ASML Holding',        620.00, date '2023-01-06', 14, 1023.00,
   'EUV lithography monopoly; the lowest-drama way to own AI capex.'),
  ('NKE',   'Nike Inc.',           125.00, date '2023-01-06', 10, 90.00,
   'My clearest mistake: underestimated inventory gluts and China. Held reduced as a reminder to respect the P&L over the story.')
) as v(ticker, company, entry_price, entry_date, weight_pct, current_price, thesis)
where s.slug = 'seine';

-- --------------------------------------------------------------------------
-- Portfolio II positions (sibling account)
-- --------------------------------------------------------------------------
insert into public.positions (sleeve_id, ticker, company, entry_price, entry_date, weight_pct, current_price, thesis, status)
select id, v.ticker, v.company, v.entry_price, v.entry_date, v.weight_pct, v.current_price, v.thesis, 'open'
from public.sleeves s
cross join (values
  ('VOO',  'Vanguard S&P 500 ETF', 360.00, date '2023-01-09', 40, 585.00,
   'Core beta at a rock-bottom fee. The humility position: most active bets should be measured against this.'),
  ('MSFT', 'Microsoft Corp.',      240.00, date '2023-01-09', 30, 505.00,
   'Enterprise software plus cloud plus a distribution advantage in AI. A durable compounder we are happy to hold quietly.'),
  ('LLY',  'Eli Lilly & Co.',      340.00, date '2023-01-09', 20, 780.00,
   'Incretin franchise with a multi-year demand runway and real pipeline optionality behind it.'),
  ('SBUX', 'Starbucks Corp.',      100.00, date '2023-01-09', 10, 95.00,
   'Turnaround bet on brand and store economics. Sized small until store traffic actually inflects.')
) as v(ticker, company, entry_price, entry_date, weight_pct, current_price, thesis)
where s.slug = 'portfolio-2';

-- --------------------------------------------------------------------------
-- Inception snapshots — both indices start at 100. The app appends a live
-- "today" point on top of these; log more from the admin panel over time.
-- --------------------------------------------------------------------------
insert into public.snapshots (sleeve_id, date, portfolio_index, sp_index)
select id, inception_date, 100, 100 from public.sleeves;
insert into public.snapshots (sleeve_id, date, portfolio_index, sp_index)
values (null, date '2023-01-03', 100, 100);   -- Combined

-- --------------------------------------------------------------------------
-- Seed the price cache so the site renders immediately before the first
-- Finnhub refresh. These are placeholder quotes; the first refresh (cron or
-- the admin "Refresh prices" button) overwrites them with live data.
-- --------------------------------------------------------------------------
insert into public.price_cache (symbol, price, prev_close, as_of, recent) values
  ('NVDA',  172.80,  171.10, now(), '[]'),
  ('COST',  900.00,  897.20, now(), '[]'),
  ('BRK.B', 465.00,  463.50, now(), '[]'),
  ('V',     319.00,  318.10, now(), '[]'),
  ('ASML',  1023.00, 1015.0, now(), '[]'),
  ('NKE',   90.00,   90.60,  now(), '[]'),
  ('VOO',   585.00,  583.20, now(), '[]'),
  ('MSFT',  505.00,  503.10, now(), '[]'),
  ('LLY',   780.00,  776.40, now(), '[]'),
  ('SBUX',  95.00,   95.40,  now(), '[]'),
  ('SPY',   620.00,  618.30, now(), '[]');

commit;
