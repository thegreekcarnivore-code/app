-- Único program template — additive only.
-- Creates the new fully-automated Único program AS A NEW ROW alongside existing templates.
-- DOES NOT touch any existing enrollments, programs, or live app data.
-- Pro-rated refunds (when Alex is ready to migrate clients) live in the migrate-to-unico edge function.

-- Lightweight key/value config (used to resolve "the único program id" without hardcoding)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'Admins manage app config') THEN
    CREATE POLICY "Admins manage app config"
      ON public.app_config FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'Authenticated read app config') THEN
    CREATE POLICY "Authenticated read app config"
      ON public.app_config FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $policy$;

DO $$
DECLARE
  v_admin_id uuid;
  v_unico_id uuid;
BEGIN
  SELECT p.id INTO v_admin_id
  FROM public.profiles p
  WHERE p.email = 'info@thegreekcarnivore.com'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin profile (info@thegreekcarnivore.com) not found — cannot create Único template';
  END IF;

  -- Idempotent insert by name. Existing programs are NOT touched.
  SELECT id INTO v_unico_id
  FROM public.program_templates
  WHERE name = 'Único'
  LIMIT 1;

  IF v_unico_id IS NULL THEN
    INSERT INTO public.program_templates (name, description, duration_weeks, feature_access, created_by)
    VALUES (
      'Único',
      'Το ένα πρόγραμμα που χρειάζεσαι. Πλήρης πρόσβαση σε ό,τι έχω χτίσει: AI Σύμβουλος εκπαιδευμένος στη φωνή μου, όλα τα βίντεο, όλες τις συνταγές, ολόκληρο το βιβλίο, ανάλυση φωτογραφιών χωρίς όριο, εβδομαδιαίες αναφορές, κοινότητα, buddy pairing. Πλήρως αυτοματοποιημένο. €47/μήνα.',
      52,
      '{
        "concierge": true,
        "explore": true,
        "delivery": true,
        "shopping": true,
        "travel": true,
        "measurements": true,
        "video_library": true,
        "resources": true,
        "coach_chat": true,
        "photo_analysis_unlimited": true,
        "auto_meal_plan": true,
        "personal_videos": true,
        "community": true,
        "buddy_pairing": true,
        "weekly_reports": true
      }'::jsonb,
      v_admin_id
    )
    RETURNING id INTO v_unico_id;
  ELSE
    -- Keep flags fresh in case we add features later
    UPDATE public.program_templates
    SET feature_access = '{
          "concierge": true,
          "explore": true,
          "delivery": true,
          "shopping": true,
          "travel": true,
          "measurements": true,
          "video_library": true,
          "resources": true,
          "coach_chat": true,
          "photo_analysis_unlimited": true,
          "auto_meal_plan": true,
          "personal_videos": true,
          "community": true,
          "buddy_pairing": true,
          "weekly_reports": true
        }'::jsonb,
        updated_at = now()
    WHERE id = v_unico_id;
  END IF;

  -- Stamp the resolved id in app_config so backend code can find it without hardcoding
  INSERT INTO public.app_config (key, value)
  VALUES ('unico_program_template_id', to_jsonb(v_unico_id::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;
