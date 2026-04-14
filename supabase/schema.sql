create extension if not exists pgcrypto;

create table if not exists public.daily_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entry_date date not null,
  resilience_score integer not null,
  rabbit_hole integer not null default 0,
  streaks integer not null default 0,
  average_escape_time integer not null,
  source text not null default 'mockapi',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists public.add_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  entry_date date not null,
  resilience_score integer not null,
  rabbit_hole integer not null default 0,
  average_escape_time integer not null,
  source text not null default 'mockapi',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_analytics_user_date
  on public.daily_analytics (user_id, entry_date);

create index if not exists idx_add_calculation_runs_user_date
  on public.add_calculation_runs (user_id, entry_date);

alter table public.daily_analytics enable row level security;
alter table public.add_calculation_runs enable row level security;

drop policy if exists "daily_analytics_public_rw" on public.daily_analytics;
create policy "daily_analytics_public_rw"
  on public.daily_analytics
  for all
  using (true)
  with check (true);

drop policy if exists "add_calculation_runs_public_rw" on public.add_calculation_runs;
create policy "add_calculation_runs_public_rw"
  on public.add_calculation_runs
  for all
  using (true)
  with check (true);
