CREATE POLICY "Enrolled users can view program templates"
ON public.program_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_program_enrollments cpe
    WHERE cpe.user_id = auth.uid()
      AND cpe.program_template_id = program_templates.id
      AND cpe.status = 'active'
  )
);