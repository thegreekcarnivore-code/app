-- Test the auto reminder system by creating a future call and verifying reminders are created

DO $$
DECLARE
    test_call_id UUID;
    reminder_count INTEGER;
    reminder_rec RECORD;
BEGIN
    -- Create a test video call 25 hours in the future
    INSERT INTO public.video_calls (
        title,
        meeting_url,
        call_type,
        scheduled_at,
        duration_minutes,
        notes,
        guest_emails,
        created_by
    ) VALUES (
        'Auto Reminder Test Call',
        'https://zoom.us/j/test123456',
        'one_on_one',
        NOW() + INTERVAL '25 hours',
        30,
        'Testing automatic reminder creation',
        ARRAY['test@thegreekcarnivore.com'],
        (SELECT id FROM profiles WHERE email = 'info@thegreekcarnivore.com' LIMIT 1)
    ) RETURNING id INTO test_call_id;
    
    -- Check if reminders were automatically created
    SELECT COUNT(*) INTO reminder_count
    FROM public.call_reminders
    WHERE video_call_id = test_call_id;
    
    -- Log the results
    RAISE NOTICE 'Test call created with ID: %', test_call_id;
    RAISE NOTICE 'Number of reminders automatically created: %', reminder_count;
    
    -- Show the reminder details
    FOR reminder_rec IN
        SELECT reminder_type, send_at, EXTRACT(EPOCH FROM (send_at - NOW())) / 3600 AS hours_until
        FROM public.call_reminders
        WHERE video_call_id = test_call_id
        ORDER BY send_at ASC
    LOOP
        RAISE NOTICE 'Reminder: % scheduled for % (in % hours)', reminder_rec.reminder_type, reminder_rec.send_at, reminder_rec.hours_until;
    END LOOP;
    
    -- Verify we have exactly 3 reminders
    IF reminder_count = 3 THEN
        RAISE NOTICE '✅ SUCCESS: Auto reminder system is working correctly!';
    ELSE
        RAISE NOTICE '❌ ERROR: Expected 3 reminders, but got %', reminder_count;
    END IF;
    
END $$;