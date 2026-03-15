CREATE TABLE public.call_notifications_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_call_id uuid NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_call_id, email)
);

ALTER TABLE public.call_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage call notifications sent"
  ON public.call_notifications_sent
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));