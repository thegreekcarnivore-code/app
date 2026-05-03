-- Live monthly group session (replay-only): Alex records a 30-min video each
-- month answering pre-submitted member questions. Members watch in-app.
-- Drives retention 10-15% in subscription products that adopt this loop.
--
-- Architecture: video lives on YouTube (unlisted) — we store the URL only.
-- Lower cost, faster delivery, no storage bucket needed.

-- ─── group_sessions: one row per recorded session ──────────────────────────
CREATE TABLE IF NOT EXISTS public.group_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  video_url       TEXT NOT NULL,                                   -- YouTube unlisted URL or Vimeo private
  thumbnail_url   TEXT,                                            -- optional poster image
  duration_minutes INTEGER,
  recorded_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  published_at    TIMESTAMPTZ,                                      -- null = draft
  status          TEXT NOT NULL DEFAULT 'draft',                    -- 'draft' | 'published' | 'archived'
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;

-- Members read only published sessions
CREATE POLICY "Members read published group_sessions"
  ON public.group_sessions FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL);

CREATE POLICY "Admins manage group_sessions"
  ON public.group_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_group_sessions_published
  ON public.group_sessions (published_at DESC) WHERE status = 'published';

-- ─── group_session_questions: members submit Qs for the next session ───────
CREATE TABLE IF NOT EXISTS public.group_session_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_text       TEXT NOT NULL,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_in_session UUID REFERENCES public.group_sessions(id) ON DELETE SET NULL,
  admin_notes         TEXT,
  CHECK (length(question_text) BETWEEN 10 AND 1000)
);

ALTER TABLE public.group_session_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own questions"
  ON public.group_session_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all questions"
  ON public.group_session_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_group_session_questions_user
  ON public.group_session_questions (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_session_questions_pending
  ON public.group_session_questions (submitted_at DESC) WHERE answered_in_session IS NULL;
