-- Pass the message content to send-message-email so the email
-- can display the actual message text instead of a generic fallback.

CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sender_is_admin   boolean;
  _has_subscriptions boolean;
  _base_url          text;
  _push_title        text;
  _push_link         text;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT has_role(NEW.sender_id, 'admin') INTO _sender_is_admin;

  _base_url := current_setting('app.settings.supabase_url', true);

  IF _base_url IS NULL OR _base_url = '' THEN
    RETURN NEW;
  END IF;

  IF _sender_is_admin THEN
    _push_title := 'Εχεις μηνυμα απο τον coach σου τον Αλεξανδρο';
    _push_link  := '/home';
  ELSE
    _push_title := 'Νέο μήνυμα από πελάτη';
    _push_link  := '/admin';
  END IF;

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

  -- Include the actual message content so the email template can display it
  PERFORM net.http_post(
    url     := _base_url || '/functions/v1/send-message-email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'receiver_id',  NEW.receiver_id,
      'sender_id',    NEW.sender_id,
      'is_automated', NEW.is_automated,
      'content',      COALESCE(NEW.content, '')
    )
  );

  RETURN NEW;
END;
$function$;
