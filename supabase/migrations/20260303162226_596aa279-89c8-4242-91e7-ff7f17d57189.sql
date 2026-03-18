
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
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
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
