-- Auto-detected client success stories surfaced from chat / community / measurements /
-- before-after photos / weekly reports. Hard rule: never push to reels.thegreekcarnivore.com
-- without explicit consent_granted_at — admin UI enforces this.

CREATE TABLE public.testimonial_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,                       -- chat | group_post | feedback | daily_win | measurement | before_after | weekly_report
  source_ref UUID,
  quote TEXT,                                 -- verbatim member words
  quantitative JSONB,                         -- {"weight_lost_kg": 4.2, "days_in_program": 28, ...}
  photo_before_url TEXT,
  photo_after_url TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending',   -- pending | requested | granted | denied
  consent_requested_at TIMESTAMPTZ,
  consent_granted_at TIMESTAMPTZ,
  consent_anonymous BOOLEAN,                  -- when true, name not displayed even if granted
  screenshot_url TEXT,                        -- generated card image (1080×1920 / 1080×1080)
  pushed_to_reels_app_at TIMESTAMPTZ,
  reels_app_asset_id TEXT,
  admin_status TEXT NOT NULL DEFAULT 'new',   -- new | approved | rejected | shipped
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonial_candidates ENABLE ROW LEVEL SECURITY;

-- Users can SEE candidates about themselves (so they can give consent in-app)
CREATE POLICY "Users read own testimonial candidates"
  ON public.testimonial_candidates FOR SELECT
  USING (auth.uid() = user_id);

-- Users update only the consent fields on their own candidates
CREATE POLICY "Users update own consent"
  ON public.testimonial_candidates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage testimonial candidates"
  ON public.testimonial_candidates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_testimonial_candidates_status
  ON public.testimonial_candidates (admin_status, detected_at DESC);

CREATE INDEX idx_testimonial_candidates_consent
  ON public.testimonial_candidates (consent_status, detected_at DESC);

CREATE INDEX idx_testimonial_candidates_user_time
  ON public.testimonial_candidates (user_id, detected_at DESC);

-- Storage bucket for rendered cards. Public read so reels app can fetch by URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonial-cards', 'testimonial-cards', true)
ON CONFLICT (id) DO NOTHING;

-- Only admins can write to the bucket
CREATE POLICY "Admins write testimonial cards"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'testimonial-cards'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins update testimonial cards"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'testimonial-cards'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Public read testimonial cards"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonial-cards');
