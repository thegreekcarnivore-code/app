-- Milestone moments: Day 21 of every paid month celebrates members who
-- have stayed engaged. Eligibility = 3-of-4 rule on (weight ≥4, food ≥8,
-- chat ≥3, days_active ≥8) in the past 30 days. Members who qualify get a
-- personalized Greek summary in-app + email. Members who don't get an
-- encouraging "almost there" nudge instead — never silence.
--
-- v1 ships text + stats. v2 will replace the text with an actual ReelForge
-- video link when the cross-app integration lands.

CREATE TABLE IF NOT EXISTS public.milestone_moments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_day   INTEGER NOT NULL,                                 -- 21, 81, 171, 351
  qualified       BOOLEAN NOT NULL,
  signals         JSONB NOT NULL DEFAULT '{}'::jsonb,               -- {weight_count, food_count, chat_count, days_active, weight_delta_kg}
  message_text    TEXT NOT NULL,
  email_subject   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_send',             -- pending_send | sent | error
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, milestone_day)                                    -- one per milestone per member
);

ALTER TABLE public.milestone_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage milestone_moments"
  ON public.milestone_moments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own milestone_moments"
  ON public.milestone_moments FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_milestone_moments_user
  ON public.milestone_moments (user_id, milestone_day DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_moments_status
  ON public.milestone_moments (status, generated_at DESC);
