
DROP TRIGGER IF EXISTS on_client_message_notify_admin ON public.messages;
DELETE FROM public.client_notifications WHERE type = 'new_message';
