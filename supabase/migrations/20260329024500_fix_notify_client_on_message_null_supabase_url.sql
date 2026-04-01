-- Fix notify_client_on_message so message inserts do not fail when
-- app.settings.supabase_url is not configured in Postgres settings.

CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _has_subscriptions boolean;
  _base_url text;
BEGIN
  SELECT has_role(NEW.sender_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);

  -- Only attempt push/email webhook calls if the base URL is configured.
  IF _base_url IS NOT NULL AND _base_url <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id
    ) INTO _has_subscriptions;

    IF _has_subscriptions THEN
      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'user_id', NEW.receiver_id,
          'title', 'Εχεις μηνυμα απο τον coach σου τον Αλεξανδρο',
          'body', LEFT(COALESCE(NEW.content, 'Ηχητικο μηνυμα'), 100),
          'link', '/home',
          'tag', 'new_message'
        )
      );
    END IF;

    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-message-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'receiver_id', NEW.receiver_id,
        'sender_id', NEW.sender_id,
        'is_automated', NEW.is_automated
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
