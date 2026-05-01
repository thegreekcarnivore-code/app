-- Schedule detect-testimonials to run every Sunday 22:00 UTC.
-- Scans the last 7 days of chat / community / feedback / wins / measurements / before-after photos
-- and inserts deduplicated rows into testimonial_candidates for admin review.

SELECT cron.unschedule('detect-testimonials')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-testimonials');

SELECT cron.schedule(
  'detect-testimonials',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/detect-testimonials',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
