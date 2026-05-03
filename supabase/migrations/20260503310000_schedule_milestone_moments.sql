-- Daily cron at 10:00 UTC: scans active members, fires the milestone moment
-- if they hit Day 21/81/171/351 today. UNIQUE (user_id, milestone_day)
-- guarantees one-time delivery per member per milestone.

SELECT cron.unschedule('generate-milestone-moments')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-milestone-moments');

SELECT cron.schedule(
  'generate-milestone-moments',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/generate-milestone-moments',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
