
-- Create report_feedback table
CREATE TABLE public.report_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  report_content text NOT NULL,
  feedback text,
  is_accepted boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all report feedback"
  ON public.report_feedback FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert report feedback"
  ON public.report_feedback FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update report feedback"
  ON public.report_feedback FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete report feedback"
  ON public.report_feedback FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create report_instructions table
CREATE TABLE public.report_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  user_id uuid,
  instruction text NOT NULL,
  source_feedback_id uuid REFERENCES public.report_feedback(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all report instructions"
  ON public.report_instructions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert report instructions"
  ON public.report_instructions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update report instructions"
  ON public.report_instructions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete report instructions"
  ON public.report_instructions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
