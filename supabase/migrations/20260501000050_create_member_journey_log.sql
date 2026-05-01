-- Per-member journey memory: append-only summarized log of milestones, struggles, decisions,
-- preferences, observations. Cheapest workable design: short Greek text snippets, recency-
-- ordered retrieval, no embeddings in v1. Storage per user after 6 months ≈ 50–100 rows.
--
-- Written by:
--   • concierge-chat (post-response classifier extracts durable signal)
--   • measurements / weight triggers (delta thresholds)
--   • food_journal weekly summarizer
--   • group_posts (win-tagged)
--   • member_feedback inserts
--   • weekly_reports generation
-- Read by:
--   • concierge-chat at session open (latest 20 rows → <member_context>)
--   • weekly analysis prompt
--   • admin journey timeline view

CREATE TABLE public.member_journey_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,                       -- milestone | struggle | preference | decision | observation
  summary TEXT NOT NULL,                    -- ≤200 chars, Greek
  source TEXT NOT NULL,                     -- concierge_chat | measurement | food_journal | community_post | feedback | weekly_report | intake
  source_ref UUID,                          -- pointer back to originating row when applicable
  raw_excerpt TEXT,                         -- short verbatim quote when relevant
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_journey_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journey log"
  ON public.member_journey_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage journey log"
  ON public.member_journey_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_member_journey_log_user_time
  ON public.member_journey_log (user_id, occurred_at DESC);

CREATE INDEX idx_member_journey_log_kind
  ON public.member_journey_log (user_id, kind, occurred_at DESC);
