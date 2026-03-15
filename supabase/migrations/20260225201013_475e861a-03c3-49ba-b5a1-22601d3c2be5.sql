
-- Video calls table
CREATE TABLE public.video_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  meeting_url TEXT NOT NULL DEFAULT '',
  call_type TEXT NOT NULL DEFAULT 'one_on_one', -- 'one_on_one' or 'group'
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Video call participants
CREATE TABLE public.video_call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_call_id UUID NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_call_id, user_id)
);

-- RLS for video_calls
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage video calls"
  ON public.video_calls FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their video calls"
  ON public.video_calls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_call_participants vcp
    WHERE vcp.video_call_id = video_calls.id AND vcp.user_id = auth.uid()
  ));

-- RLS for video_call_participants
ALTER TABLE public.video_call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage video call participants"
  ON public.video_call_participants FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own participation"
  ON public.video_call_participants FOR SELECT
  USING (auth.uid() = user_id);
