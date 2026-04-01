-- Test script to verify the reminder system is working

-- Check current video calls
SELECT 
  id,
  title,
  scheduled_at,
  EXTRACT(EPOCH FROM (scheduled_at - NOW())) / 3600 AS hours_until_call
FROM video_calls 
WHERE scheduled_at > NOW()
ORDER BY scheduled_at ASC
LIMIT 5;

-- Check existing call reminders
SELECT 
  cr.id,
  vc.title,
  cr.reminder_type,
  cr.send_at,
  EXTRACT(EPOCH FROM (cr.send_at - NOW())) / 60 AS minutes_until_send,
  cr.sent_at
FROM call_reminders cr
JOIN video_calls vc ON cr.video_call_id = vc.id
WHERE cr.sent_at IS NULL
ORDER BY cr.send_at ASC
LIMIT 10;

-- Create a test video call in the future to verify auto-scheduling
INSERT INTO video_calls (
  title,
  meeting_url,
  call_type,
  scheduled_at,
  duration_minutes,
  notes,
  guest_emails
) VALUES (
  'Test Call - Reminder System',
  'https://zoom.us/j/123456789',
  'one_on_one',
  NOW() + INTERVAL '25 hours',  -- 25 hours from now
  30,
  'Testing the automatic reminder system',
  ARRAY['test@example.com']
)
RETURNING id, title, scheduled_at;

-- Check if reminders were automatically created for the test call
SELECT 
  cr.reminder_type,
  cr.send_at,
  EXTRACT(EPOCH FROM (cr.send_at - NOW())) / 3600 AS hours_until_send
FROM call_reminders cr
JOIN video_calls vc ON cr.video_call_id = vc.id
WHERE vc.title = 'Test Call - Reminder System'
ORDER BY cr.send_at ASC;