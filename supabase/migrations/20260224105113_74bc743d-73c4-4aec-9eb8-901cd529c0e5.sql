
-- Add feature_access jsonb to program_templates
ALTER TABLE public.program_templates ADD COLUMN IF NOT EXISTS feature_access jsonb NOT NULL DEFAULT '{"concierge":true,"explore":true,"delivery":true,"shopping":true,"travel":true,"measurements":true,"video_library":true,"resources":true}'::jsonb;

-- Create saved_ai_prompts table for reusable AI prompt templates
CREATE TABLE public.saved_ai_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage saved prompts" ON public.saved_ai_prompts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
