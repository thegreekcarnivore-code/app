CREATE TABLE public.weekly_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enrollment_id uuid NULL REFERENCES public.client_program_enrollments(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  due_at timestamptz NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  language text NOT NULL DEFAULT 'el',
  status text NOT NULL DEFAULT 'generated',
  summary text NOT NULL DEFAULT '',
  report_content text NOT NULL DEFAULT '',
  coach_message text NOT NULL DEFAULT '',
  data_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_check_ins_language_check CHECK (language IN ('en', 'el')),
  CONSTRAINT weekly_check_ins_status_check CHECK (status IN ('generated', 'reminder')),
  CONSTRAINT weekly_check_ins_user_week_end_key UNIQUE (user_id, week_end)
);

ALTER TABLE public.weekly_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly check-ins" ON public.weekly_check_ins
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage weekly check-ins" ON public.weekly_check_ins
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_weekly_check_ins_user_due_at
  ON public.weekly_check_ins (user_id, due_at DESC);
