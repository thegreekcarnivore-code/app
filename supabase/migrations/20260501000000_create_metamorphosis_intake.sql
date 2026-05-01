-- Metamorphosis intake form: rich per-member context that feeds personalization, the Σύμβουλος,
-- meal plan generation, and weekly analysis. One row per user (PK = user_id) so the form is
-- naturally edit-in-place. raw_payload is forward-compat for new questions without migrations.

CREATE TABLE public.member_intakes (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,

  -- Snapshot-at-intake demographics (some duplicate profiles intentionally)
  weight_kg NUMERIC(5,2),
  target_weight_kg NUMERIC(5,2),
  activity_level TEXT,                              -- sedentary | light | moderate | very_active

  -- Goals & struggles
  primary_goal TEXT,                                -- weight_loss | health | energy | mental_clarity | other
  primary_goal_detail TEXT,
  biggest_struggle TEXT,
  past_diet_attempts TEXT,

  -- Food preferences
  favorite_meats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  disliked_foods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  eats_eggs BOOLEAN,
  eats_dairy BOOLEAN,
  eats_organs BOOLEAN,
  cooking_skill TEXT,                               -- none | basic | intermediate | advanced

  -- Allergies & medical context (informational; never used as basis for advice)
  allergies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  medical_conditions TEXT,
  medications TEXT,
  pregnant_or_breastfeeding BOOLEAN NOT NULL DEFAULT false,

  -- Lifestyle
  typical_schedule TEXT,
  social_eating_situations TEXT,
  alcohol_frequency TEXT,                           -- never | rarely | weekly | daily
  sleep_hours NUMERIC(3,1),
  stress_level INTEGER,                             -- 1-10

  -- Commitment / emotional anchors
  why_now TEXT,
  biggest_fear TEXT,

  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own intake"
  ON public.member_intakes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own intake"
  ON public.member_intakes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own intake"
  ON public.member_intakes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage intakes"
  ON public.member_intakes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_member_intakes_completed_at
  ON public.member_intakes (completed_at DESC NULLS LAST);
