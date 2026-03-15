
CREATE TABLE public.call_transcript_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.call_transcript_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage transcript history"
  ON public.call_transcript_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
