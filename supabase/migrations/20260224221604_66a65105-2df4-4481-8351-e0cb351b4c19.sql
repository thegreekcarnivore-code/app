
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _invitation record;
BEGIN
  SELECT * INTO _invitation FROM public.email_invitations
  WHERE email = NEW.email AND status = 'pending'
  LIMIT 1;

  IF _invitation IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, approved)
    VALUES (NEW.id, NEW.email, true);

    IF _invitation.program_template_id IS NOT NULL THEN
      INSERT INTO public.client_program_enrollments (user_id, program_template_id, feature_access_override, start_date, created_by)
      VALUES (
        NEW.id,
        _invitation.program_template_id,
        _invitation.feature_access,
        COALESCE(_invitation.start_date, CURRENT_DATE),
        _invitation.created_by
      );
    END IF;

    -- Create initial measurement entry if measurement_date is set
    IF _invitation.measurement_date IS NOT NULL THEN
      INSERT INTO public.measurements (user_id, measured_at)
      VALUES (NEW.id, _invitation.measurement_date::timestamptz);
    END IF;

    UPDATE public.email_invitations
    SET status = 'used', used_at = now(), used_by = NEW.id
    WHERE id = _invitation.id;
  ELSE
    INSERT INTO public.profiles (id, email, approved)
    VALUES (NEW.id, NEW.email, CASE WHEN NEW.email = 'info@thegreekcarnivore.com' THEN true ELSE false END);

    IF NEW.email = 'info@thegreekcarnivore.com' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
