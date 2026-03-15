ALTER TABLE public.client_programs
  ADD COLUMN IF NOT EXISTS prospect_email text,
  ADD COLUMN IF NOT EXISTS program_template_id uuid REFERENCES public.program_templates(id);