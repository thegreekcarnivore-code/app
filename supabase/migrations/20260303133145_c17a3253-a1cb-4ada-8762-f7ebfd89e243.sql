
-- Trigger: notify client when they receive a new message from admin
CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
  _sender_name text;
BEGIN
  -- Only for messages from admin to non-admin
  SELECT has_role(NEW.sender_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN NEW;
  END IF;

  -- Don't notify if sender = receiver (self-test)
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_notifications (user_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    'new_message',
    'New message from your coach',
    LEFT(COALESCE(NEW.content, 'Voice message'), 100),
    '/home'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_client_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_on_message();
