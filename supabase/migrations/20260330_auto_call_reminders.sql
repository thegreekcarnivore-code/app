-- Create function to automatically schedule call reminders
CREATE OR REPLACE FUNCTION auto_schedule_call_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any existing pending reminders for this call
  DELETE FROM public.call_reminders 
  WHERE video_call_id = NEW.id 
    AND sent_at IS NULL;
  
  -- Only create reminders for future calls that have participants
  IF NEW.scheduled_at > NOW() THEN
    -- Check if the call has participants (either registered users or guest emails)
    DECLARE
      has_participants BOOLEAN := FALSE;
    BEGIN
      -- Check for registered participants
      SELECT EXISTS(
        SELECT 1 FROM public.video_call_participants 
        WHERE video_call_id = NEW.id
      ) INTO has_participants;
      
      -- Check for guest emails if no registered participants
      IF NOT has_participants AND NEW.guest_emails IS NOT NULL AND array_length(NEW.guest_emails, 1) > 0 THEN
        has_participants := TRUE;
      END IF;
      
      -- Only create reminders if there are participants
      IF has_participants THEN
        -- Insert the three reminder records
        INSERT INTO public.call_reminders (video_call_id, reminder_type, send_at)
        VALUES 
          -- 24 hours before
          (NEW.id, '24h', NEW.scheduled_at - INTERVAL '24 hours'),
          -- 1 hour before  
          (NEW.id, '1h', NEW.scheduled_at - INTERVAL '1 hour'),
          -- 5 minutes before
          (NEW.id, '5min', NEW.scheduled_at - INTERVAL '5 minutes')
        -- Only insert reminders that would be sent in the future
        ON CONFLICT DO NOTHING;
        
        -- Filter out any reminders that would be sent in the past
        DELETE FROM public.call_reminders 
        WHERE video_call_id = NEW.id 
          AND send_at <= NOW() 
          AND sent_at IS NULL;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS trigger_auto_schedule_call_reminders_insert ON public.video_calls;
CREATE TRIGGER trigger_auto_schedule_call_reminders_insert
  AFTER INSERT ON public.video_calls
  FOR EACH ROW
  EXECUTE FUNCTION auto_schedule_call_reminders();

-- Create trigger for UPDATE operations (when schedule changes)
DROP TRIGGER IF EXISTS trigger_auto_schedule_call_reminders_update ON public.video_calls;
CREATE TRIGGER trigger_auto_schedule_call_reminders_update
  AFTER UPDATE OF scheduled_at, guest_emails ON public.video_calls
  FOR EACH ROW
  WHEN (OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at OR OLD.guest_emails IS DISTINCT FROM NEW.guest_emails)
  EXECUTE FUNCTION auto_schedule_call_reminders();

-- Helper function for participant changes
CREATE OR REPLACE FUNCTION auto_schedule_call_reminders_for_participants()
RETURNS TRIGGER AS $$
DECLARE
  call_id UUID;
  call_scheduled_at TIMESTAMPTZ;
BEGIN
  -- Get call ID from either NEW or OLD record
  call_id := COALESCE(NEW.video_call_id, OLD.video_call_id);
  
  -- Get the call details
  SELECT scheduled_at INTO call_scheduled_at 
  FROM public.video_calls 
  WHERE id = call_id;
  
  -- Re-trigger the auto-scheduling for this call
  IF call_scheduled_at IS NOT NULL THEN
    -- Delete existing pending reminders
    DELETE FROM public.call_reminders 
    WHERE video_call_id = call_id 
      AND sent_at IS NULL;
    
    -- Only create reminders for future calls
    IF call_scheduled_at > NOW() THEN
      DECLARE
        has_participants BOOLEAN := FALSE;
        guest_emails TEXT[];
      BEGIN
        -- Check for registered participants
        SELECT EXISTS(
          SELECT 1 FROM public.video_call_participants 
          WHERE video_call_id = call_id
        ) INTO has_participants;
        
        -- Check for guest emails if no registered participants
        IF NOT has_participants THEN
          SELECT vc.guest_emails INTO guest_emails
          FROM public.video_calls vc
          WHERE vc.id = call_id;
          
          IF guest_emails IS NOT NULL AND array_length(guest_emails, 1) > 0 THEN
            has_participants := TRUE;
          END IF;
        END IF;
        
        -- Only create reminders if there are participants
        IF has_participants THEN
          -- Insert the three reminder records
          INSERT INTO public.call_reminders (video_call_id, reminder_type, send_at)
          VALUES 
            -- 24 hours before
            (call_id, '24h', call_scheduled_at - INTERVAL '24 hours'),
            -- 1 hour before  
            (call_id, '1h', call_scheduled_at - INTERVAL '1 hour'),
            -- 5 minutes before
            (call_id, '5min', call_scheduled_at - INTERVAL '5 minutes');
          
          -- Filter out any reminders that would be sent in the past
          DELETE FROM public.call_reminders 
          WHERE video_call_id = call_id 
            AND send_at <= NOW() 
            AND sent_at IS NULL;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for participant changes  
DROP TRIGGER IF EXISTS trigger_auto_schedule_call_reminders_participants ON public.video_call_participants;
CREATE TRIGGER trigger_auto_schedule_call_reminders_participants
  AFTER INSERT OR DELETE ON public.video_call_participants
  FOR EACH ROW
  EXECUTE FUNCTION auto_schedule_call_reminders_for_participants();