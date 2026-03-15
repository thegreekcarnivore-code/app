
-- Create recipe_categories table for dynamic book management
CREATE TABLE public.recipe_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label_el text NOT NULL DEFAULT '',
  label_en text NOT NULL DEFAULT '',
  color_from text NOT NULL DEFAULT 'amber-700',
  color_to text NOT NULL DEFAULT 'amber-900',
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage recipe categories" ON public.recipe_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view
CREATE POLICY "Authenticated users can view recipe categories" ON public.recipe_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed the 4 default categories
INSERT INTO public.recipe_categories (key, label_el, label_en, color_from, color_to, sort_order) VALUES
  ('carnivore', 'Κάρνιβορ Συνταγές', 'Carnivore Recipes', 'amber-700', 'amber-900', 1),
  ('lion', 'Λάιον Διατροφή', 'Lion Diet', 'yellow-600', 'yellow-800', 2),
  ('light_carnivore', 'Ελαφριά Κάρνιβορ', 'Light Carnivore', 'orange-600', 'orange-800', 3),
  ('keto', 'Κέτο', 'Keto', 'emerald-700', 'emerald-900', 4);
