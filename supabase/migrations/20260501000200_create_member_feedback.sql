-- Member feedback / ideas / bug reports. Auto-acknowledged by Σύμβουλος in-app, pinged to
-- OpenClaw → Telegram/Discord. NEVER routes to Alex personally.

CREATE TABLE public.member_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                       -- idea | bug | content_request | praise | complaint
  message TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',          -- open | reviewing | planned | shipped | declined
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own feedback"
  ON public.member_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own feedback"
  ON public.member_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage feedback"
  ON public.member_feedback FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_member_feedback_status_time
  ON public.member_feedback (status, created_at DESC);

CREATE INDEX idx_member_feedback_user_time
  ON public.member_feedback (user_id, created_at DESC);
