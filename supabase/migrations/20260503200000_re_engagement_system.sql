-- Re-engagement system: track which members got which message, when, what
-- angle, and whether they responded. Anti-spam guardrails enforced via columns.
--
-- Pipeline:
--   1. Daily cron picks members in risk bands 🟡🟠🔴⚫ (computed from
--      profiles + measurements + food_journal + concierge_chat history).
--   2. For each, builds an in-app + email message using gpt-4.1-mini and
--      the locked tier templates (no cancellation language).
--   3. Lands the message in this table with status='pending_approval'.
--   4. Admin reviews in /admin → Health → Pending Outreach, approves.
--   5. On approve, message is sent in-app (Σύμβουλος chat row) + email.
--
-- Locked rules:
--   - 7-day cooldown per member
--   - 4-message cap per 60-day window
--   - Cooldown extends to 14 days when member responds after a message
--   - Opt-out via profiles.re_engagement_paused

-- ─── opt-out flag on profiles ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS re_engagement_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_engagement_paused_at TIMESTAMPTZ;

-- ─── audit table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.re_engagement_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,                                    -- '1' | '2a' | '2b' | '3' | '4'
  trigger_signal  TEXT NOT NULL,                                    -- 'no_login' | 'no_food_log' | 'no_weight' | 'weight_gained' | 'no_chat'
  days_idle       INTEGER NOT NULL,
  generated_text  TEXT NOT NULL,
  email_subject   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_approval',         -- 'pending_approval' | 'approved_sent' | 'skipped' | 'edited_sent'
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID,
  sent_at         TIMESTAMPTZ,
  member_responded_at TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.re_engagement_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage re_engagement_messages"
  ON public.re_engagement_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_re_engagement_user_time
  ON public.re_engagement_messages (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_re_engagement_status
  ON public.re_engagement_messages (status, generated_at DESC);

-- ─── helper: count messages sent in last N days ────────────────────────────
CREATE OR REPLACE FUNCTION public.re_engagement_recent_count(p_user_id UUID, p_days INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.re_engagement_messages
  WHERE user_id = p_user_id
    AND status IN ('approved_sent', 'edited_sent')
    AND sent_at >= (now() - (p_days || ' days')::interval);
$$;
