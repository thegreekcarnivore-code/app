-- Fix notify_push_on_insert so client_notifications inserts (and the upstream
-- measurement / message / photo inserts that trigger them) do not fail when
-- app.settings.supabase_url is not configured in Postgres settings.
--
-- Bug observed 2026-04-21: bulk measurement save in app.thegreekcarnivore.com
-- failed with: null value in column "url" of relation "http_request_queue"
-- violates not-null constraint.
--
-- Same pattern as 20260329024500 (which fixed the equivalent issue for
-- notify_client_on_message). Behavior preserved: when the base URL IS
-- configured, push notifications fire exactly as before.

CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _has_subscriptions boolean;
  _base_url text;
BEGIN
  _base_url := current_setting('app.settings.supabase_url', true);

  -- Skip the webhook entirely if the base URL isn't configured. The bell
  -- notification has already been inserted by the caller; the push is just a
  -- best-effort side-effect and must never block the parent transaction.
  IF _base_url IS NULL OR _base_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-push-notification',
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
