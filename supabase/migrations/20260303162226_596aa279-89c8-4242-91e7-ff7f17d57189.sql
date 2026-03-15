
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _has_subscriptions boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url := 'https://lglgmhzgxyvyftdhvdsy.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbGdtaHpneHl2eWZ0ZGh2ZHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ5OTMsImV4cCI6MjA4NjUxMDk5M30.ZlCbWuDfb2NIhaT0bMNUpGLMbic-X94IhoWOPSw0MaE'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'link', COALESCE(NEW.link, '/home'),
        'tag', NEW.type
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
