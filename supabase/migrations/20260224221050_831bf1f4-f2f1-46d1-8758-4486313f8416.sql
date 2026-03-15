
-- Table to store pending email invitations with pre-configured access
CREATE TABLE public.email_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  feature_access jsonb NOT NULL DEFAULT '{"travel": true, "explore": true, "delivery": true, "shopping": true, "concierge": true, "resources": true, "measurements": true, "video_library": true}'::jsonb,
  program_template_id uuid REFERENCES public.program_templates(id),
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid
);

ALTER TABLE public.email_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email invitations"
  ON public.email_invitations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user to auto-approve and enroll invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _invitation record;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT * INTO _invitation FROM public.email_invitations
  WHERE email = NEW.email AND status = 'pending'
  LIMIT 1;

  IF _invitation IS NOT NULL THEN
    -- Auto-approve invited users
    INSERT INTO public.profiles (id, email, approved)
    VALUES (NEW.id, NEW.email, true);

    -- Create enrollment if a program was assigned
    IF _invitation.program_template_id IS NOT NULL THEN
      INSERT INTO public.client_program_enrollments (user_id, program_template_id, feature_access_override, created_by)
      VALUES (NEW.id, _invitation.program_template_id, _invitation.feature_access, _invitation.created_by);
    END IF;

    -- Mark invitation as used
    UPDATE public.email_invitations
    SET status = 'used', used_at = now(), used_by = NEW.id
    WHERE id = _invitation.id;
  ELSE
    -- Default behavior
    INSERT INTO public.profiles (id, email, approved)
    VALUES (NEW.id, NEW.email, CASE WHEN NEW.email = 'info@thegreekcarnivore.com' THEN true ELSE false END);

    IF NEW.email = 'info@thegreekcarnivore.com' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
