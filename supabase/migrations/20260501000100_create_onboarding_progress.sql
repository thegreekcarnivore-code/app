-- Day-1..Day-7 onboarding tracker. Distinct from program_template_messages (which tracks
-- "what was sent") — this tracks "what the member completed in-app". Day-1 baseline is the
-- gate: until measurements + 4 photos are recorded, Day 2+ stay locked.

CREATE TABLE public.onboarding_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.client_program_enrollments(id) ON DELETE CASCADE,
  current_day INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  day_completions JSONB NOT NULL DEFAULT '{}'::jsonb,    -- { "1": "<ts>", "2": "<ts>", ... }
  last_nudge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own onboarding"
  ON public.onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding"
  ON public.onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage onboarding"
  ON public.onboarding_progress FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
