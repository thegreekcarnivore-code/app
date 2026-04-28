-- Único program foundation
-- Tables:
--   coach_knowledge          — RAG corpus for the Alex Clone Concierge (pgvector)
--   personal_videos          — library of pre-recorded short clips, milestone-tagged
--   personal_video_deliveries — per-user delivery log (no repeats)
--   daily_wins               — Μικρή Νίκη entries surfaced on the home dashboard
--   streak_state             — current/longest streak per user
--   buddy_pairings           — Day-14 auto-matched accountability pairs
--   crisis_flags             — escalation queue for the weekly safety-net skim

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── coach_knowledge ────────────────────────────────────────────────────────
CREATE TABLE public.coach_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL,           -- 'fathom_call' | 'message' | 'ebook' | 'lead_magnet' | 'email' | 'recipe_note' | 'reels_caption' | 'manual'
  source_id TEXT,                      -- foreign key as string (recording_id, message uuid, etc.)
  source_title TEXT,
  source_url TEXT,
  language TEXT NOT NULL DEFAULT 'el',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),              -- OpenAI text-embedding-3-small
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coach knowledge"
  ON public.coach_knowledge
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_coach_knowledge_source
  ON public.coach_knowledge (source_type, source_id);

CREATE INDEX idx_coach_knowledge_embedding
  ON public.coach_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TRIGGER coach_knowledge_touch_updated_at
BEFORE UPDATE ON public.coach_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.match_coach_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.72,
  match_count INTEGER DEFAULT 8,
  filter_language TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_title TEXT,
  source_url TEXT,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ck.id,
    ck.source_type,
    ck.source_title,
    ck.source_url,
    ck.chunk_text,
    1 - (ck.embedding <=> query_embedding) AS similarity,
    ck.metadata
  FROM public.coach_knowledge ck
  WHERE ck.embedding IS NOT NULL
    AND (filter_language IS NULL OR ck.language = filter_language)
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── personal_videos ────────────────────────────────────────────────────────
CREATE TABLE public.personal_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,          -- Supabase Storage object path
  duration_seconds INTEGER,
  language TEXT NOT NULL DEFAULT 'el',
  trigger_tags TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'day_1','plateau','weekend','social_situation','milestone_30d'}
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage personal videos"
  ON public.personal_videos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users read active personal videos"
  ON public.personal_videos
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE INDEX idx_personal_videos_trigger_tags
  ON public.personal_videos USING GIN (trigger_tags);

CREATE TRIGGER personal_videos_touch_updated_at
BEFORE UPDATE ON public.personal_videos
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- ─── personal_video_deliveries ──────────────────────────────────────────────
CREATE TABLE public.personal_video_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_video_id UUID NOT NULL REFERENCES public.personal_videos(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  watched_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, personal_video_id)
);

ALTER TABLE public.personal_video_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deliveries"
  ON public.personal_video_deliveries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own deliveries"
  ON public.personal_video_deliveries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all deliveries"
  ON public.personal_video_deliveries
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_personal_video_deliveries_user
  ON public.personal_video_deliveries (user_id, delivered_at DESC);

-- ─── daily_wins ─────────────────────────────────────────────────────────────
CREATE TABLE public.daily_wins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  win_date DATE NOT NULL,
  win_type TEXT NOT NULL DEFAULT 'general',  -- 'meal_logged' | 'measurement' | 'photo' | 'community_post' | 'streak_kept' | 'general'
  win_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, win_date, win_type)
);

ALTER TABLE public.daily_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own daily wins"
  ON public.daily_wins
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own daily wins"
  ON public.daily_wins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all daily wins"
  ON public.daily_wins
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_daily_wins_user_date
  ON public.daily_wins (user_id, win_date DESC);

-- ─── streak_state ───────────────────────────────────────────────────────────
CREATE TABLE public.streak_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streak"
  ON public.streak_state
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all streaks"
  ON public.streak_state
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER streak_state_touch_updated_at
BEFORE UPDATE ON public.streak_state
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

-- ─── buddy_pairings ─────────────────────────────────────────────────────────
CREATE TABLE public.buddy_pairings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'ended' | 'cancelled'
  shared_goal TEXT,
  CHECK (user_a <> user_b)
);

ALTER TABLE public.buddy_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buddies read their pairing"
  ON public.buddy_pairings
  FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Admins manage buddy pairings"
  ON public.buddy_pairings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_buddy_pairings_user_a
  ON public.buddy_pairings (user_a, status);

CREATE INDEX idx_buddy_pairings_user_b
  ON public.buddy_pairings (user_b, status);

-- ─── crisis_flags ───────────────────────────────────────────────────────────
CREATE TABLE public.crisis_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL,                -- 'concierge_chat' | 'community_post' | 'food_journal' | 'manual'
  source_ref TEXT,                     -- chat session id, post id, etc.
  severity TEXT NOT NULL DEFAULT 'medium',   -- 'low' | 'medium' | 'high'
  category TEXT NOT NULL,              -- 'self_harm' | 'medical_emergency' | 'eating_disorder' | 'other'
  excerpt TEXT,
  detector_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crisis_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage crisis flags"
  ON public.crisis_flags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_crisis_flags_unreviewed
  ON public.crisis_flags (created_at DESC)
  WHERE reviewed_at IS NULL;

CREATE INDEX idx_crisis_flags_user
  ON public.crisis_flags (user_id, created_at DESC);
