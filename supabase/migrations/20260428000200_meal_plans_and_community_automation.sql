-- Meal plans + community automation supporting tables

-- ─── meal_plans ─────────────────────────────────────────────────────────────
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  language TEXT NOT NULL DEFAULT 'el',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'auto_weekly',  -- 'auto_weekly' | 'manual_request' | 'plateau_trigger'
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,     -- { days: [{ date, meals: [{slot, recipe_id, title, notes}] }] }
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, week_start, source)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own meal plans"
  ON public.meal_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all meal plans"
  ON public.meal_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_meal_plans_user_week
  ON public.meal_plans (user_id, week_start DESC);

-- ─── community_prompt_templates ─────────────────────────────────────────────
-- Library of weekly prompts the community-auto-prompt cron rotates through
CREATE TABLE public.community_prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dow INTEGER NOT NULL CHECK (dow BETWEEN 0 AND 6),  -- 0=Sun, 1=Mon, ...
  language TEXT NOT NULL DEFAULT 'el',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT,                                          -- 'monday_intention' | 'wednesday_win' | 'friday_weekend' | 'sunday_reflection'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage prompt templates"
  ON public.community_prompt_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users read active prompts"
  ON public.community_prompt_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE INDEX idx_community_prompt_templates_dow
  ON public.community_prompt_templates (dow, is_active);

-- Seed the locked Mon/Wed/Fri/Sun rhythm
INSERT INTO public.community_prompt_templates (dow, language, title, body, tag)
VALUES
  (1, 'el', 'Νέα βδομάδα. Τι θα πετύχεις;',
   'Καλή Δευτέρα. Πες ένα πράγμα — μόνο ένα — που θα κάνεις αυτή τη βδομάδα και θα νιώσεις περήφανος/η το βράδυ της Κυριακής. Όχι λίστα. Ένα.',
   'monday_intention'),
  (3, 'el', 'Μοιράσου μία μικρή νίκη',
   'Είμαστε στη μέση της βδομάδας. Πες μου μία μικρή νίκη της σημερινής μέρας — μπορεί να είναι ότι είπες ''όχι'' σε κάτι, ότι έφαγες σωστά σε δύσκολη στιγμή, ότι κοιμήθηκες βαθύτερα. Οι μικρές νίκες κάνουν τα χρόνια.',
   'wednesday_win'),
  (5, 'el', 'Σαββατοκύριακο έρχεται. Ρωτήσου κάτι.',
   'Το 70% των carnivore αποτυχιών συμβαίνει το σαββατοκύριακο. Όχι επειδή δεν ξέρεις τι να κάνεις — επειδή χαλαρώνεις. Πες μου: τι σκοπεύεις να κάνεις διαφορετικά αυτό το σαββατοκύριακο για να μη βρεθείς πίσω τη Δευτέρα;',
   'friday_weekend'),
  (0, 'el', 'Κυριακή απολογισμού',
   'Δες πίσω τη βδομάδα. Τι έμαθες για τον εαυτό σου; Τι θα κρατήσεις; Τι θα αλλάξεις από Δευτέρα;',
   'sunday_reflection');

-- ─── community_auto_posts ──────────────────────────────────────────────────
-- Tracks posts the cron has published so we don't double-post
CREATE TABLE public.community_auto_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID,                                     -- nullable: posts may be global
  prompt_template_id UUID REFERENCES public.community_prompt_templates(id) ON DELETE SET NULL,
  group_post_id UUID,                                -- the inserted group_posts row
  posted_for_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (prompt_template_id, posted_for_date)
);

ALTER TABLE public.community_auto_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage community auto posts"
  ON public.community_auto_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ─── community_post_moderation ──────────────────────────────────────────────
CREATE TABLE public.community_post_moderation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_post_id UUID NOT NULL,
  flagged BOOLEAN NOT NULL DEFAULT false,
  categories JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  detector_model TEXT NOT NULL DEFAULT 'omni-moderation-latest',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_post_id)
);

ALTER TABLE public.community_post_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage community moderation"
  ON public.community_post_moderation FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_community_post_moderation_flagged
  ON public.community_post_moderation (flagged, created_at DESC)
  WHERE flagged = true AND reviewed_at IS NULL;
