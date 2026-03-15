
CREATE TABLE public.call_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_call_id UUID NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '24h', '1h', '5min'
  send_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.call_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage call reminders" ON public.call_reminders
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_call_reminders_pending ON public.call_reminders (send_at) WHERE sent_at IS NULL;
