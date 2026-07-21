-- Migration: adds Pre-Session Plan / Post-Session Review columns to an
-- already-live trading_days table, and seeds the reference lists.
-- Safe to run once in Supabase SQL Editor while authenticated as your app user.
-- (schema.sql now contains these same statements for anyone setting up fresh.)

alter table trading_days add column if not exists pre_max_loss numeric;
alter table trading_days add column if not exists pre_setups text;
alter table trading_days add column if not exists pre_mental_state text;
alter table trading_days add column if not exists pre_notes text;
alter table trading_days add column if not exists plan_followed boolean;
alter table trading_days add column if not exists plan_deviation_notes text;

-- ---- Seed data (safe to re-run; duplicates are skipped) ----

insert into emotions_master (user_id, name) values
  (auth.uid(), 'Confident'),
  (auth.uid(), 'Calm'),
  (auth.uid(), 'Focused'),
  (auth.uid(), 'Patient'),
  (auth.uid(), 'Disciplined'),
  (auth.uid(), 'Content'),
  (auth.uid(), 'Optimistic'),
  (auth.uid(), 'Curious'),
  (auth.uid(), 'Cautious'),
  (auth.uid(), 'Uncertain'),
  (auth.uid(), 'Bored'),
  (auth.uid(), 'Indifferent'),
  (auth.uid(), 'Hesitant'),
  (auth.uid(), 'Anxious'),
  (auth.uid(), 'Frustrated'),
  (auth.uid(), 'Impatient'),
  (auth.uid(), 'FOMO'),
  (auth.uid(), 'Greedy'),
  (auth.uid(), 'Overconfident'),
  (auth.uid(), 'Revenge-driven'),
  (auth.uid(), 'Fearful'),
  (auth.uid(), 'Regretful'),
  (auth.uid(), 'Panicked'),
  (auth.uid(), 'Angry'),
  (auth.uid(), 'Ashamed / Embarrassed'),
  (auth.uid(), 'Hopeless / Defeated')
on conflict (user_id, name) do nothing;

insert into market_conditions_master (user_id, name) values
  (auth.uid(), 'Strong Uptrend'),
  (auth.uid(), 'Strong Downtrend'),
  (auth.uid(), 'Range-bound / Choppy'),
  (auth.uid(), 'Breakout'),
  (auth.uid(), 'Reversal'),
  (auth.uid(), 'High Volatility / News-Driven'),
  (auth.uid(), 'Low Volume / Quiet')
on conflict (user_id, name) do nothing;

insert into rules_master (user_id, name) values
  (auth.uid(), 'Entered without a clear setup/signal'),
  (auth.uid(), 'Chased price (FOMO entry)'),
  (auth.uid(), 'No defined stop loss before entering'),
  (auth.uid(), 'Position size too large for the setup/conviction'),
  (auth.uid(), 'Entered against the higher-timeframe trend without justification'),
  (auth.uid(), 'Averaged into a losing position (revenge-added size)'),
  (auth.uid(), 'Risked more than planned % of account on a single trade'),
  (auth.uid(), 'Moved stop loss further away instead of honoring it'),
  (auth.uid(), 'No stop loss at all'),
  (auth.uid(), 'Over-leveraged / used too much margin'),
  (auth.uid(), 'Held through earnings/news without accounting for gap risk'),
  (auth.uid(), 'Exited winner too early out of fear'),
  (auth.uid(), 'Held loser too long hoping it would recover'),
  (auth.uid(), 'Moved profit target after it was hit (greed)'),
  (auth.uid(), 'Did not take partial profits at planned levels'),
  (auth.uid(), 'Revenge traded immediately after a loss'),
  (auth.uid(), 'Traded outside planned hours/session'),
  (auth.uid(), 'Traded a symbol not on the watchlist'),
  (auth.uid(), 'Skipped pre-market plan/checklist'),
  (auth.uid(), 'Overtraded (exceeded max trades per day)'),
  (auth.uid(), 'Traded while distracted, tired, or emotionally compromised'),
  (auth.uid(), 'Ignored a "no-trade day" rule')
on conflict (user_id, name) do nothing;
