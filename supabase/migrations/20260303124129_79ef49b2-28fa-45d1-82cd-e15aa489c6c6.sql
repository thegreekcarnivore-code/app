
-- Function to call push notification edge function when a client_notification is inserted
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_subscriptions boolean;
BEGIN
  -- Check if user has any push subscriptions
  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id
  ) INTO _has_subscriptions;

  IF _has_subscriptions THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
$$;

-- Create trigger
CREATE TRIGGER on_client_notification_insert
AFTER INSERT ON public.client_notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_insert();
