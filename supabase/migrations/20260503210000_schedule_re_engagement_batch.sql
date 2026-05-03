-- Daily cron at 08:00 UTC: generate-re-engagement-batch scans active members,
-- identifies those in 🟡 slipping / 🟠 at_risk / 🔴 lost / ⚫ deep_lost bands,
-- and lands a personalized message in re_engagement_messages with
-- status='pending_approval'. Admin reviews + sends from the Health tab.

SELECT cron.unschedule('generate-re-engagement-batch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-re-engagement-batch');

SELECT cron.schedule(
  'generate-re-engagement-batch',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/generate-re-engagement-batch',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
