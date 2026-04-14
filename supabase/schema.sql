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

create table if not exists public.sprint_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  sprint_id text not null,
  sprint_number integer,
  title text not null,
  focus_task text,
  entry_date date not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_minutes integer not null,
  rabbit_holes integer not null default 0,
  focus_score integer not null default 100,
  resilience_score integer not null default 100,
  recovery_speed integer not null default 100,
  distraction_depth integer not null default 100,
  productive_recovery integer not null default 100,
  total_time_spent_distracted_ms bigint not null default 0,
  total_focus_time_after_return_ms bigint not null default 0,
  average_time_spent_distracted_ms bigint not null default 0,
  average_remaining_sprint_time_ms bigint not null default 0,
  source text not null default 'sprint',
  tools jsonb,
  rabbit_hole_log jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sprint_id)
);

create index if not exists idx_daily_analytics_user_date
  on public.daily_analytics (user_id, entry_date);

create index if not exists idx_add_calculation_runs_user_date
  on public.add_calculation_runs (user_id, entry_date);

create index if not exists idx_sprint_sessions_user_date
  on public.sprint_sessions (user_id, entry_date, completed_at desc);

alter table public.daily_analytics enable row level security;
alter table public.add_calculation_runs enable row level security;
alter table public.sprint_sessions enable row level security;

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

drop policy if exists "sprint_sessions_public_rw" on public.sprint_sessions;
create policy "sprint_sessions_public_rw"
  on public.sprint_sessions
  for all
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.daily_analytics to anon, authenticated, service_role;
grant select, insert, update, delete on public.add_calculation_runs to anon, authenticated, service_role;
grant select, insert, update, delete on public.sprint_sessions to anon, authenticated, service_role;
