
-- Create recommendation_history table
CREATE TABLE public.recommendation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tab text NOT NULL,
  request_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "Users can view own history"
ON public.recommendation_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own history
CREATE POLICY "Users can insert own history"
ON public.recommendation_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own history
CREATE POLICY "Users can delete own history"
ON public.recommendation_history
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all history
CREATE POLICY "Admins can view all history"
ON public.recommendation_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cleanup function: keep only latest 10 per tab per user
CREATE OR REPLACE FUNCTION public.cleanup_old_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.recommendation_history
  WHERE id IN (
    SELECT id FROM public.recommendation_history
    WHERE user_id = NEW.user_id AND tab = NEW.tab
    ORDER BY created_at DESC
    OFFSET 10
  );
  RETURN NEW;
END;
$$;

-- Trigger to auto-cleanup after insert
CREATE TRIGGER cleanup_recommendation_history
AFTER INSERT ON public.recommendation_history
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_old_history();

-- Index for fast lookups
CREATE INDEX idx_recommendation_history_user_tab ON public.recommendation_history (user_id, tab, created_at DESC);
