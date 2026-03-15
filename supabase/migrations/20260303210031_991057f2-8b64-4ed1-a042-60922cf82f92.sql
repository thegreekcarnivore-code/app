
-- 1. Admin sends message → push to client (no bell)
DROP TRIGGER IF EXISTS on_message_notify_client ON public.messages;
CREATE TRIGGER on_message_notify_client
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_message();

-- 2. Client sends message → bell for admin
DROP TRIGGER IF EXISTS on_client_message_notify_admin ON public.messages;
CREATE TRIGGER on_client_message_notify_admin
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_client_message();

-- 3. Client logs weight → bell for admin
DROP TRIGGER IF EXISTS on_measurement_notify_admin ON public.measurements;
CREATE TRIGGER on_measurement_notify_admin
  AFTER INSERT ON public.measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_measurement();

-- 4. Client uploads photo → bell for admin
DROP TRIGGER IF EXISTS on_photo_notify_admin ON public.progress_photos;
CREATE TRIGGER on_photo_notify_admin
  AFTER INSERT ON public.progress_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_photo();

-- 5. Any bell notification → auto push
DROP TRIGGER IF EXISTS on_notification_push ON public.client_notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();
