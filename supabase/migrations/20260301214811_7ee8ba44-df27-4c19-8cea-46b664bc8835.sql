
-- wellness_journal table
CREATE TABLE public.wellness_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wellness_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own wellness journal" ON public.wellness_journal FOR ALL USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- measurement_comments table
CREATE TABLE public.measurement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.measurement_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view comments on own measurements" ON public.measurement_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM measurements m WHERE m.id = measurement_id AND m.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Users can insert comments on own measurements" ON public.measurement_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM measurements m WHERE m.id = measurement_id AND m.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
CREATE POLICY "Admins can insert comments on any measurement" ON public.measurement_comments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
