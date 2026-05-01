-- Schedule summarize-food-journal-weekly to run every Sunday 21:00 UTC.
-- One short Greek observation per active member, appended to member_journey_log
-- so the Σύμβουλος sees food patterns at next session open.

SELECT cron.unschedule('summarize-food-journal-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'summarize-food-journal-weekly');

SELECT cron.schedule(
  'summarize-food-journal-weekly',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/summarize-food-journal-weekly',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
