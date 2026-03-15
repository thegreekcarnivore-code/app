
-- Table: measurements
CREATE TABLE public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric,
  height_cm numeric,
  fat_kg numeric,
  muscle_kg numeric,
  waist_cm numeric,
  hip_cm numeric,
  arm_cm numeric,
  leg_cm numeric,
  energy smallint,
  digestion smallint,
  skin_health smallint,
  mood smallint,
  stress smallint,
  cravings smallint,
  breathing_health smallint,
  mental_health smallint,
  pain smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own measurements" ON public.measurements FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own measurements" ON public.measurements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own measurements" ON public.measurements FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own measurements" ON public.measurements FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Table: food_journal
CREATE TABLE public.food_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food journal" ON public.food_journal FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own food journal" ON public.food_journal FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own food journal" ON public.food_journal FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own food journal" ON public.food_journal FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_food_journal_updated_at BEFORE UPDATE ON public.food_journal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: progress_photos
CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  angle text NOT NULL DEFAULT 'front',
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress photos" ON public.progress_photos FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own progress photos" ON public.progress_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own progress photos" ON public.progress_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own progress photos" ON public.progress_photos FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('food-photos', 'food-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

-- Storage policies for food-photos
CREATE POLICY "Users can upload food photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view food photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'food-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users can delete food photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'food-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

-- Storage policies for progress-photos
CREATE POLICY "Users can upload progress photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view progress photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'progress-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Users can delete progress photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'progress-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
