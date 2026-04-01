-- Clean up the test call and its reminders
DELETE FROM public.call_reminders 
WHERE video_call_id IN (
  SELECT id FROM public.video_calls 
  WHERE title = 'Auto Reminder Test Call'
);

DELETE FROM public.video_calls 
WHERE title = 'Auto Reminder Test Call';