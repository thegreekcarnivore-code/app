
-- Remove duplicate trigger on messages table (both call the same function)
DROP TRIGGER IF EXISTS trg_notify_client_on_message ON public.messages;

-- Remove duplicate trigger on client_notifications table (both call the same function)
DROP TRIGGER IF EXISTS on_notification_push ON public.client_notifications;

-- Clean up stale in-app bell notifications for admin-to-client messages
DELETE FROM public.client_notifications
WHERE type = 'new_message'
  AND title LIKE '%coach%Αλεξανδρο%';
