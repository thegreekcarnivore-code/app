-- 1. Attach existing trigger functions to their tables

-- When a message is inserted, notify the client (if sent by admin)
CREATE TRIGGER on_message_notify_client
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_message();

-- When a measurement is inserted, notify admin
CREATE TRIGGER on_measurement_notify_admin
  AFTER INSERT ON public.measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_measurement();

-- When a progress photo is inserted, notify admin
CREATE TRIGGER on_photo_notify_admin
  AFTER INSERT ON public.progress_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_photo();

-- When a client_notification is inserted, fire push notification
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();

-- 2. New: Notify admin when a CLIENT sends a message
CREATE OR REPLACE FUNCTION public.notify_admin_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
  _client_name text;
BEGIN
  SELECT has_role(NEW.sender_id, 'admin') INTO _is_admin;
  IF _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, split_part(email, '@', 1), 'Client') INTO _client_name
  FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.client_notifications (user_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    'new_message',
    _client_name || ' sent you a message',
    LEFT(COALESCE(NEW.content, 'Voice message'), 100),
    '/admin/client/' || NEW.sender_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_client_message_notify_admin
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_client_message();