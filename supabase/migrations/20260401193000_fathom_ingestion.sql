CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.fathom_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL DEFAULT 'newMeeting',
  recording_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.fathom_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Fathom webhook events"
  ON public.fathom_webhook_events
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.fathom_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recording_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'fathom',
  event_type TEXT NOT NULL DEFAULT 'newMeeting',
  title TEXT NOT NULL DEFAULT '',
  meeting_title TEXT,
  meeting_url TEXT NOT NULL DEFAULT '',
  share_url TEXT,
  transcript_language TEXT,
  scheduled_start_time TIMESTAMP WITH TIME ZONE,
  scheduled_end_time TIMESTAMP WITH TIME ZONE,
  recording_start_time TIMESTAMP WITH TIME ZONE,
  recording_end_time TIMESTAMP WITH TIME ZONE,
  calendar_invitees_domains_type TEXT,
  recorded_by_name TEXT,
  recorded_by_email TEXT,
  recorded_by_team TEXT,
  recorded_by_email_domain TEXT,
  participant_count INTEGER NOT NULL DEFAULT 0,
  external_participant_count INTEGER NOT NULL DEFAULT 0,
  call_type TEXT NOT NULL DEFAULT 'one_on_one',
  summary_template_name TEXT,
  summary_markdown TEXT,
  transcript_text TEXT NOT NULL DEFAULT '',
  transcript_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  crm_matches JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_status TEXT NOT NULL DEFAULT 'pending',
  automation_last_error TEXT,
  automation_processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fathom_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Fathom recordings"
  ON public.fathom_recordings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.fathom_recording_invitees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fathom_recording_id UUID NOT NULL REFERENCES public.fathom_recordings(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  matched_speaker_display_name TEXT,
  is_external BOOLEAN NOT NULL DEFAULT false,
  email_domain TEXT,
  matched_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fathom_recording_invitees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Fathom invitees"
  ON public.fathom_recording_invitees
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.fathom_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fathom_recording_id UUID NOT NULL REFERENCES public.fathom_recordings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  user_generated BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  recording_timestamp TEXT,
  recording_playback_url TEXT,
  assignee_name TEXT,
  assignee_email TEXT,
  assignee_team TEXT,
  matched_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fathom_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage Fathom action items"
  ON public.fathom_action_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_fathom_recordings_recording_start
  ON public.fathom_recordings (recording_start_time DESC);

CREATE INDEX idx_fathom_recordings_automation_status
  ON public.fathom_recordings (automation_status, recording_start_time DESC);

CREATE INDEX idx_fathom_recording_invitees_recording
  ON public.fathom_recording_invitees (fathom_recording_id);

CREATE INDEX idx_fathom_recording_invitees_matched_user
  ON public.fathom_recording_invitees (matched_user_id);

CREATE INDEX idx_fathom_action_items_recording
  ON public.fathom_action_items (fathom_recording_id);

CREATE INDEX idx_fathom_action_items_matched_user
  ON public.fathom_action_items (matched_user_id);

CREATE TRIGGER fathom_recordings_touch_updated_at
BEFORE UPDATE ON public.fathom_recordings
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
