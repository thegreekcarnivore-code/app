
-- Create recipes table
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sort_order integer NOT NULL DEFAULT 0,
  title_el text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  ingredients_el text NOT NULL DEFAULT '',
  ingredients_en text NOT NULL DEFAULT '',
  instructions_el text NOT NULL DEFAULT '',
  instructions_en text NOT NULL DEFAULT '',
  tip_el text NOT NULL DEFAULT '',
  tip_en text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  program_template_id uuid REFERENCES public.program_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all recipes
CREATE POLICY "Admins can manage recipes"
  ON public.recipes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view recipes with null program_template_id
CREATE POLICY "Authenticated users can view general recipes"
  ON public.recipes FOR SELECT
  USING (program_template_id IS NULL AND auth.uid() IS NOT NULL);

-- Enrolled users can view recipes linked to their program
CREATE POLICY "Enrolled users can view program recipes"
  ON public.recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_program_enrollments cpe
      WHERE cpe.user_id = auth.uid()
        AND cpe.program_template_id = recipes.program_template_id
        AND cpe.status = 'active'
    )
  );

-- Create recipe-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true);

-- Allow authenticated users to read recipe images
CREATE POLICY "Anyone can view recipe images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-images');

-- Allow admins to upload recipe images
CREATE POLICY "Admins can upload recipe images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recipe-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete recipe images
CREATE POLICY "Admins can delete recipe images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'recipe-images' AND has_role(auth.uid(), 'admin'::app_role));
