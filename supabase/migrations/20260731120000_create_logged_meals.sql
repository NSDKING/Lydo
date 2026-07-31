-- Persists meals the user has actually logged as eaten (both plan-meal toggles and
-- ad-hoc "extra" items), so the log survives app restarts and plan regeneration.
-- kind='plan'  -> a toggle on a specific slot in the generated weekly plan
--                 (plan_day/plan_meal_index identify the slot; unique per user+date+slot)
-- kind='extra' -> a standalone logged item (barcode/AI-scan/manual/saved recipe)
create table if not exists public.logged_meals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  logged_date date not null,
  kind text not null check (kind in ('plan', 'extra')),
  plan_day text,
  plan_meal_index integer,
  name text not null,
  calories integer not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric,
  meal_source text not null default 'plan' check (meal_source in ('plan', 'barcode', 'ai', 'manual')),
  healthkit_uuid text,
  created_at timestamptz not null default now(),
  unique (user_id, logged_date, plan_day, plan_meal_index)
);

create index if not exists logged_meals_user_date_idx on public.logged_meals (user_id, logged_date);

alter table public.logged_meals enable row level security;

create policy "manage own logged meals" on public.logged_meals
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
