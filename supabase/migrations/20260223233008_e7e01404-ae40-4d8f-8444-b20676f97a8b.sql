
-- 1. program_templates
CREATE TABLE public.program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_weeks integer NOT NULL DEFAULT 26,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.program_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program templates" ON public.program_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. program_messages
CREATE TABLE public.program_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  day_offset integer NOT NULL DEFAULT 0,
  recurrence text,
  recurrence_end_day integer,
  message_content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.program_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program messages" ON public.program_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. program_tasks
CREATE TABLE public.program_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  day_offset integer NOT NULL DEFAULT 0,
  recurrence text,
  recurrence_end_day integer,
  task_type text NOT NULL DEFAULT 'custom',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  linked_content_id uuid,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.program_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program tasks" ON public.program_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. program_videos
CREATE TABLE public.program_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  youtube_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  sequence_order integer NOT NULL DEFAULT 0,
  unlock_after_video_id uuid REFERENCES public.program_videos(id) ON DELETE SET NULL
);
ALTER TABLE public.program_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program videos" ON public.program_videos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. program_documents
CREATE TABLE public.program_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  document_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.program_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program documents" ON public.program_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. program_forms
CREATE TABLE public.program_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  requires_signature boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.program_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage program forms" ON public.program_forms FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. client_program_enrollments
CREATE TABLE public.client_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  program_template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  weekly_day integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage enrollments" ON public.client_program_enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own enrollments" ON public.client_program_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Now enrollment-dependent policies
CREATE POLICY "Enrolled users can view program videos" ON public.program_videos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.client_program_enrollments cpe WHERE cpe.user_id = auth.uid() AND cpe.program_template_id = program_videos.program_template_id AND cpe.status = 'active')
);
CREATE POLICY "Enrolled users can view program documents" ON public.program_documents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.client_program_enrollments cpe WHERE cpe.user_id = auth.uid() AND cpe.program_template_id = program_documents.program_template_id AND cpe.status = 'active')
);
CREATE POLICY "Enrolled users can view program forms" ON public.program_forms FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.client_program_enrollments cpe WHERE cpe.user_id = auth.uid() AND cpe.program_template_id = program_forms.program_template_id AND cpe.status = 'active')
);

-- 8. client_form_signatures
CREATE TABLE public.client_form_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  form_id uuid NOT NULL REFERENCES public.program_forms(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.client_program_enrollments(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  signature_url text NOT NULL DEFAULT '',
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);
ALTER TABLE public.client_form_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all signatures" ON public.client_form_signatures FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own signatures" ON public.client_form_signatures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own signatures" ON public.client_form_signatures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 9. client_video_progress
CREATE TABLE public.client_video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.program_videos(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.client_program_enrollments(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_video_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all video progress" ON public.client_video_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own video progress" ON public.client_video_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own video progress" ON public.client_video_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own video progress" ON public.client_video_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 10. client_tasks
CREATE TABLE public.client_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enrollment_id uuid NOT NULL REFERENCES public.client_program_enrollments(id) ON DELETE CASCADE,
  source_task_id uuid REFERENCES public.program_tasks(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  task_type text NOT NULL DEFAULT 'custom',
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  linked_content_id uuid
);
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage client tasks" ON public.client_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own tasks" ON public.client_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.client_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('program-documents', 'program-documents', false);

-- Storage RLS
CREATE POLICY "Users can upload own signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own sigs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can view all sigs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage program docs storage" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'program-documents' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'program-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users can view program docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'program-documents');

-- Trigger
CREATE TRIGGER update_program_templates_updated_at BEFORE UPDATE ON public.program_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
