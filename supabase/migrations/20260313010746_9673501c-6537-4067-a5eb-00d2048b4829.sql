
-- Add is_automated column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_automated boolean NOT NULL DEFAULT false;

-- Update the notify_client_on_message trigger function to also call send-message-email
CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _has_subscriptions boolean;
BEGIN
  SELECT has_role(NEW.sender_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  -- Send push notification
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
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

  -- Send email notification via edge function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-message-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'receiver_id', NEW.receiver_id,
      'sender_id', NEW.sender_id,
      'is_automated', NEW.is_automated
    )
  );

  RETURN NEW;
END;
$function$;
