-- Audit fix (follow-up) — 2026-04-21
--
-- Goal: make push notifications actually fire. The intended fix was
--   ALTER DATABASE postgres SET app.settings.supabase_url = '...';
-- but the Supabase Management API role lacks permission for ALTER DATABASE.
--
-- Workaround: patch the two trigger functions that rely on that setting to
-- fall back to a hardcoded project URL when `app.settings.supabase_url` is
-- NULL or empty. Behavior is identical to the ALTER DATABASE approach —
-- push notifications will fire — and if the setting IS ever configured via
-- the dashboard later, it takes precedence (so this fallback is forward-
-- compatible).
--
-- Both functions retain the NULL-safe short-circuit: if the resolved URL is
-- empty for any reason, they RETURN NEW without calling net.http_post.

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
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://bowvosskzbtuxmrwatoj.supabase.co';
  END IF;

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
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://bowvosskzbtuxmrwatoj.supabase.co';
  END IF;

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
