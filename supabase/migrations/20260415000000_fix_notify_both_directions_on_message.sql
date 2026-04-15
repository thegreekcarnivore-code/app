-- Fix notify_client_on_message to work in BOTH directions:
--   admin → client: notify the client (existing behaviour)
--   client → admin: notify the coach (was silently dropped before)

CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sender_is_admin  boolean;
  _has_subscriptions boolean;
  _base_url text;
  _push_title text;
  _push_link  text;
BEGIN
  -- Never notify on self-messages
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT has_role(NEW.sender_id, 'admin') INTO _sender_is_admin;

  _base_url := current_setting('app.settings.supabase_url', true);

  -- Only attempt webhook calls if the base URL is configured
  IF _base_url IS NULL OR _base_url = '' THEN
    RETURN NEW;
  END IF;

  -- Build push notification content based on direction
  IF _sender_is_admin THEN
    -- Admin → Client
    _push_title := 'Εχεις μηνυμα απο τον coach σου τον Αλεξανδρο';
    _push_link  := '/home';
  ELSE
    -- Client → Admin (coach)
    _push_title := 'Νέο μήνυμα από πελάτη';
    _push_link  := '/admin';
  END IF;

  -- Push notification (if receiver has subscriptions)
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url     := _base_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'user_id', NEW.receiver_id,
        'title',   _push_title,
        'body',    LEFT(COALESCE(NEW.content, 'Ηχητικό μήνυμα'), 100),
        'link',    _push_link,
        'tag',     'new_message'
      )
    );
  END IF;

  -- Email notification (handles both directions inside the edge function)
  PERFORM net.http_post(
    url     := _base_url || '/functions/v1/send-message-email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'receiver_id',  NEW.receiver_id,
      'sender_id',    NEW.sender_id,
      'is_automated', NEW.is_automated
    )
  );

  RETURN NEW;
END;
$function$;
