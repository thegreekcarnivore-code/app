-- Daily cron at 09:00 UTC: check-ai-cost-spikes scans the current month's
-- api_usage rows, surfaces members ≥ €3.50 (amber) or ≥ €5 (red), and posts
-- a single combined ping to whichever notifier env vars are set on Supabase
-- (Telegram, Discord, OpenClaw). Idempotent — read-only over api_usage.

SELECT cron.unschedule('check-ai-cost-spikes')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-ai-cost-spikes');

SELECT cron.schedule(
  'check-ai-cost-spikes',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/check-ai-cost-spikes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
