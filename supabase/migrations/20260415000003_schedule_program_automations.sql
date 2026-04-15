-- Schedule process-program-automations to run every 30 minutes via pg_cron.
-- This is what fires all scheduled program messages (day 1, day 5, day 7, etc.).
-- Without this, automated program messages would never be sent.

SELECT cron.schedule(
  'process-program-automations',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/process-program-automations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
