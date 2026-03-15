
-- Create video_modules table
CREATE TABLE public.video_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_template_id UUID NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  is_sequential BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add module_id and unlock_after_days to program_videos
ALTER TABLE public.program_videos
  ADD COLUMN module_id UUID REFERENCES public.video_modules(id) ON DELETE SET NULL,
  ADD COLUMN unlock_after_days INTEGER;

-- Enable RLS
ALTER TABLE public.video_modules ENABLE ROW LEVEL SECURITY;

-- Admin can manage modules
CREATE POLICY "Admins can manage video modules"
  ON public.video_modules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enrolled users can view modules
CREATE POLICY "Enrolled users can view video modules"
  ON public.video_modules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_enrollments cpe
      WHERE cpe.user_id = auth.uid()
        AND cpe.program_template_id = video_modules.program_template_id
        AND cpe.status = 'active'
    )
  );
