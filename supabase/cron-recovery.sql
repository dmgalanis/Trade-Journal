-- ============================================================
-- Cron Recovery Script
-- ============================================================
-- Run this in the Supabase SQL Editor any time cron jobs are
-- missing from cron.job (e.g. after a restore, or if
-- cron-health-check.yml alerts you that jobs vanished).
--
-- Covers all five jobs currently relied on:
--   - session-reminder-pre-edt / -pre-est
--   - session-reminder-post-edt / -post-est
--   - daily-backup-trigger
--
-- Safe to re-run: cron.schedule() with an existing jobname updates
-- it in place rather than erroring, so you can run this even if
-- some (not all) of the five jobs still exist.
--
-- After running, verify with:
--   select jobid, jobname, schedule, active from cron.job order by jobname;
-- You should see exactly 5 rows, all active = true.
-- ============================================================

select cron.schedule(
  'session-reminder-pre-edt',
  '45 12 * * *',  -- 8:45am EDT
  $$
  select net.http_post(
    url := 'https://pzodswksfsprmfxpswjz.supabase.co/functions/v1/session-reminder-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4'
    ),
    body := jsonb_build_object('mode', 'pre')
  );
  $$
);

select cron.schedule(
  'session-reminder-pre-est',
  '45 13 * * *',  -- 8:45am EST (off-season no-op in summer)
  $$
  select net.http_post(
    url := 'https://pzodswksfsprmfxpswjz.supabase.co/functions/v1/session-reminder-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4'
    ),
    body := jsonb_build_object('mode', 'pre')
  );
  $$
);

select cron.schedule(
  'session-reminder-post-edt',
  '0 0 * * *',  -- 8:00pm EDT
  $$
  select net.http_post(
    url := 'https://pzodswksfsprmfxpswjz.supabase.co/functions/v1/session-reminder-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4'
    ),
    body := jsonb_build_object('mode', 'post')
  );
  $$
);

select cron.schedule(
  'session-reminder-post-est',
  '0 1 * * *',  -- 8:00pm EST (off-season no-op in summer)
  $$
  select net.http_post(
    url := 'https://pzodswksfsprmfxpswjz.supabase.co/functions/v1/session-reminder-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4'
    ),
    body := jsonb_build_object('mode', 'post')
  );
  $$
);

select cron.schedule(
  'daily-backup-trigger',
  '0 7 * * *',  -- ~2am EST / 3am EDT
  $$
  select net.http_post(
    url := 'https://pzodswksfsprmfxpswjz.supabase.co/functions/v1/github-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2Rzd2tzZnNwcm1meHBzd2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDc1NzQsImV4cCI6MjA5OTEyMzU3NH0.5lPVa8LuzSDl96LiUsJu4r9ZPbHt5dkLj2dMX-45Ir4'
    ),
    body := jsonb_build_object('action', 'backup')
  );
  $$
);

-- Verify:
select jobid, jobname, schedule, active from cron.job order by jobname;
