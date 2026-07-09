-- Trading Journal Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ========== MASTER (EDITABLE) LISTS ==========
-- Each user manages their own list of rules, emotions, market conditions, volatility types

create table if not exists rules_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists emotions_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists market_conditions_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists volatility_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

-- ========== DAILY JOURNAL ENTRY ==========

create table if not exists trading_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  followed_rules boolean, -- null = not yet answered
  market_condition_id uuid references market_conditions_master(id) on delete set null,
  volatility_id uuid references volatility_master(id) on delete set null,
  notes text,
  improvements text,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, entry_date)
);

-- Join table: which rule violations happened on a given day
create table if not exists day_violations (
  id uuid primary key default gen_random_uuid(),
  trading_day_id uuid not null references trading_days(id) on delete cascade,
  rule_id uuid not null references rules_master(id) on delete cascade,
  unique (trading_day_id, rule_id)
);

-- Join table: which emotions were felt on a given day
create table if not exists day_emotions (
  id uuid primary key default gen_random_uuid(),
  trading_day_id uuid not null references trading_days(id) on delete cascade,
  emotion_id uuid not null references emotions_master(id) on delete cascade,
  unique (trading_day_id, emotion_id)
);

-- Screenshots attached to a day (metadata; actual files live in Storage)
create table if not exists screenshots (
  id uuid primary key default gen_random_uuid(),
  trading_day_id uuid not null references trading_days(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz default now()
);

-- ========== ROW LEVEL SECURITY ==========

alter table rules_master enable row level security;
alter table emotions_master enable row level security;
alter table market_conditions_master enable row level security;
alter table volatility_master enable row level security;
alter table trading_days enable row level security;
alter table day_violations enable row level security;
alter table day_emotions enable row level security;
alter table screenshots enable row level security;

-- Master lists: user can only see/edit their own
create policy "own rules" on rules_master for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own emotions" on emotions_master for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own market conditions" on market_conditions_master for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own volatility" on volatility_master for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trading days: user can only see/edit their own
create policy "own trading days" on trading_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Join tables: access controlled via parent trading_day's user_id
create policy "own day violations" on day_violations for all
  using (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()))
  with check (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()));

create policy "own day emotions" on day_emotions for all
  using (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()))
  with check (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()));

create policy "own screenshots" on screenshots for all
  using (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()))
  with check (exists (select 1 from trading_days td where td.id = trading_day_id and td.user_id = auth.uid()));

-- ========== STORAGE BUCKET FOR SCREENSHOTS ==========
-- Run this too (or create the bucket "screenshots" manually in Dashboard > Storage, set to Private)

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "own screenshot files read"
  on storage.objects for select
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own screenshot files insert"
  on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own screenshot files delete"
  on storage.objects for delete
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

-- ========== SEED DEFAULT LISTS (optional, edit as you like) ==========
-- These insert starter values for the CURRENTLY LOGGED IN user. Run this in the SQL editor
-- while authenticated, or just add these through the app's Settings page instead.
