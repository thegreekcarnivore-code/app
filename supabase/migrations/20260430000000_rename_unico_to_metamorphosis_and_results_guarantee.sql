-- Rename Único → Μεταμόρφωση (Metamorphosis) and add results-guarantee compliance tracking.
-- Per locked decision 2026-04-30: 60-day RESULTS guarantee replaces 30-day no-questions refund.
-- Refund eligibility = followed program faithfully AND no weight-loss result.

-- ─── Rename program template + app_config key ──────────────────────────────
DO $$
DECLARE
  v_unico_id uuid;
BEGIN
  -- Rename the program_templates row (idempotent)
  SELECT id INTO v_unico_id
  FROM public.program_templates
  WHERE name IN ('Único', 'Μεταμόρφωση', 'Metamorphosis')
  ORDER BY CASE WHEN name = 'Μεταμόρφωση' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_unico_id IS NOT NULL THEN
    UPDATE public.program_templates
    SET name = 'Μεταμόρφωση',
        description = 'Το ένα πρόγραμμα που χρειάζεσαι. Lifestyle coaching και εκπαίδευση. Πλήρης πρόσβαση στον AI Σύμβουλο, σε όλα τα βίντεο, στο βιβλίο, στις συνταγές, στις εβδομαδιαίες αναφορές. Δεν περιμένεις. Εγγύηση αποτελέσματος 60 ημερών.',
        updated_at = now()
    WHERE id = v_unico_id;
  END IF;

  -- Migrate the app_config key from unico_program_template_id → metamorphosis_program_template_id
  IF EXISTS (SELECT 1 FROM public.app_config WHERE key = 'unico_program_template_id') THEN
    INSERT INTO public.app_config (key, value)
    SELECT 'metamorphosis_program_template_id', value
    FROM public.app_config
    WHERE key = 'unico_program_template_id'
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

    DELETE FROM public.app_config WHERE key = 'unico_program_template_id';
  ELSIF v_unico_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.app_config WHERE key = 'metamorphosis_program_template_id'
  ) THEN
    INSERT INTO public.app_config (key, value)
    VALUES ('metamorphosis_program_template_id', to_jsonb(v_unico_id::text));
  END IF;

  -- Default the guarantee window in app_config so we don't hardcode it
  INSERT INTO public.app_config (key, value)
  VALUES ('metamorphosis_guarantee_days', to_jsonb(60))
  ON CONFLICT (key) DO NOTHING;
END $$;

-- ─── compliance_snapshots ───────────────────────────────────────────────────
-- Weekly snapshot per Metamorphosis enrollee. Drives refund eligibility decisions.
CREATE TABLE public.compliance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.client_program_enrollments(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  window_days INTEGER NOT NULL DEFAULT 7,           -- the rolling window this snapshot covers
  daily_checkin_rate NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0..1, fraction of days with food_journal entries
  weighed_in BOOLEAN NOT NULL DEFAULT false,
  meal_plan_engaged BOOLEAN NOT NULL DEFAULT false,
  book_chapters_read INTEGER NOT NULL DEFAULT 0,
  weight_change_kg NUMERIC(6,2),                    -- nullable: may be unknown until we have 2+ measurements
  raw_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own compliance snapshots"
  ON public.compliance_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage compliance snapshots"
  ON public.compliance_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_compliance_snapshots_user_date
  ON public.compliance_snapshots (user_id, snapshot_date DESC);

-- ─── refund_eligibility_evaluations ─────────────────────────────────────────
-- Audit trail: every time we evaluate a refund claim, record what we saw and what we decided.
CREATE TABLE public.refund_eligibility_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.client_program_enrollments(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guarantee_window_days INTEGER NOT NULL DEFAULT 60,
  enrollment_start_date DATE,
  days_since_start INTEGER,
  weight_loss_kg NUMERIC(6,2),
  compliance_score NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0..1 composite score
  compliance_threshold NUMERIC(5,2) NOT NULL DEFAULT 0.80,
  weight_loss_threshold_kg NUMERIC(6,2) NOT NULL DEFAULT 0,   -- "no result" = lost <= this many kg
  eligible BOOLEAN NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  refund_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'declined' | 'paid' | 'errored'
  refund_id TEXT,
  refund_amount_cents INTEGER,
  notes TEXT
);

ALTER TABLE public.refund_eligibility_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own refund evaluations"
  ON public.refund_eligibility_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage refund evaluations"
  ON public.refund_eligibility_evaluations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_refund_evaluations_user_date
  ON public.refund_eligibility_evaluations (user_id, evaluated_at DESC);

CREATE INDEX idx_refund_evaluations_status
  ON public.refund_eligibility_evaluations (refund_status, evaluated_at DESC);
