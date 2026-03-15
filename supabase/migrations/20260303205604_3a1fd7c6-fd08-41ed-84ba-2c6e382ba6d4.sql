
-- 1) Update notify_client_on_message to send PUSH DIRECTLY instead of inserting into client_notifications (no bell)
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

  -- Send push notification directly (no in-app bell)
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url := 'https://lglgmhzgxyvyftdhvdsy.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbGdtaHpneHl2eWZ0ZGh2ZHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ5OTMsImV4cCI6MjA4NjUxMDk5M30.ZlCbWuDfb2NIhaT0bMNUpGLMbic-X94IhoWOPSw0MaE'
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

  RETURN NEW;
END;
$function$;

-- 2) Create ALL missing triggers

-- Messages: admin->client push (no bell)
DROP TRIGGER IF EXISTS on_message_notify_client ON public.messages;
CREATE TRIGGER on_message_notify_client
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_message();

-- Messages: client->admin bell notification
DROP TRIGGER IF EXISTS on_client_message_notify_admin ON public.messages;
CREATE TRIGGER on_client_message_notify_admin
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_client_message();

-- Measurements: admin bell notification
DROP TRIGGER IF EXISTS on_measurement_notify_admin ON public.measurements;
CREATE TRIGGER on_measurement_notify_admin
  AFTER INSERT ON public.measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_measurement();

-- Progress photos: admin bell notification
DROP TRIGGER IF EXISTS on_photo_notify_admin ON public.progress_photos;
CREATE TRIGGER on_photo_notify_admin
  AFTER INSERT ON public.progress_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_photo();

-- Client notifications: auto-send push when bell notification is created
DROP TRIGGER IF EXISTS on_notification_push ON public.client_notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();
