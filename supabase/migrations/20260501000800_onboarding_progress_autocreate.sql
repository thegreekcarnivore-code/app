-- Auto-create an onboarding_progress row whenever a user enrolls in the Metamorphosis program.
-- The row is upserted so re-enrollment does not blow away an existing journey, but a fresh
-- enrollment for someone who never had progress will start at Day 1 automatically.

CREATE OR REPLACE FUNCTION public.ensure_onboarding_progress_for_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metamorphosis_id uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (value #>> '{}')::uuid INTO v_metamorphosis_id
  FROM public.app_config
  WHERE key = 'unico_program_template_id'
  LIMIT 1;

  IF v_metamorphosis_id IS NULL OR NEW.program_template_id <> v_metamorphosis_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.onboarding_progress (user_id, enrollment_id, current_day)
  VALUES (NEW.user_id, NEW.id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET enrollment_id = COALESCE(public.onboarding_progress.enrollment_id, EXCLUDED.enrollment_id),
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_onboarding_progress ON public.client_program_enrollments;
CREATE TRIGGER trg_ensure_onboarding_progress
AFTER INSERT ON public.client_program_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_onboarding_progress_for_enrollment();
