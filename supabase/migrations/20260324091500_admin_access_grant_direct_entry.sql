CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF current_setting('app.profile_approval_context', true) IN ('duplicate-profile-merge', 'system-access-grant') THEN
      RETURN NEW;
    END IF;

    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.approved := OLD.approved;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_profile_access_system(_user_id uuid, _feature_access jsonb DEFAULT NULL::jsonb)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _updated_profile public.profiles%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  PERFORM set_config('app.profile_approval_context', 'system-access-grant', true);

  UPDATE public.profiles
  SET approved = true,
      feature_access = CASE
        WHEN _feature_access IS NULL THEN public.profiles.feature_access
        ELSE public.merge_feature_access_json(public.profiles.feature_access, _feature_access)
      END
  WHERE id = _user_id
  RETURNING * INTO _updated_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found', _user_id;
  END IF;

  RETURN _updated_profile;
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_profile_access_system(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_profile_access_system(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _invitation record;
  _legacy_profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO _legacy_profile
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.email IS NOT NULL
    AND lower(p.email) = lower(NEW.email)
    AND p.id <> NEW.id
    AND u.id IS NULL
  ORDER BY p.created_at ASC
  LIMIT 1;

  SELECT *
  INTO _invitation
  FROM public.email_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _legacy_profile IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      approved,
      feature_access,
      display_name,
      height_cm,
      sex,
      date_of_birth,
      language,
      timezone,
      vocative_name_el,
      avatar_url,
      onboarding_tour_completed,
      stripe_customer_id
    )
    VALUES (
      NEW.id,
      NEW.email,
      false,
      COALESCE(_legacy_profile.feature_access, '{}'::jsonb),
      _legacy_profile.display_name,
      _legacy_profile.height_cm,
      _legacy_profile.sex,
      _legacy_profile.date_of_birth,
      COALESCE(NULLIF(_legacy_profile.language, ''), COALESCE(_invitation.language, 'el')),
      _legacy_profile.timezone,
      _legacy_profile.vocative_name_el,
      _legacy_profile.avatar_url,
      COALESCE(_legacy_profile.onboarding_tour_completed, false),
      _legacy_profile.stripe_customer_id
    )
    ON CONFLICT (id) DO NOTHING;

    PERFORM public._merge_duplicate_profiles(_legacy_profile.id, NEW.id);
  ELSIF _invitation IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, approved, feature_access, language)
    VALUES (
      NEW.id,
      NEW.email,
      false,
      COALESCE(_invitation.feature_access, '{}'::jsonb),
      COALESCE(NULLIF(_invitation.language, ''), 'el')
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (id, email, approved)
    VALUES (
      NEW.id,
      NEW.email,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF _invitation IS NOT NULL THEN
    PERFORM public.grant_profile_access_system(NEW.id, _invitation.feature_access);

    IF _invitation.program_template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.client_program_enrollments
        WHERE user_id = NEW.id
          AND program_template_id = _invitation.program_template_id
      )
    THEN
      INSERT INTO public.client_program_enrollments (
        user_id,
        program_template_id,
        feature_access_override,
        start_date,
        weekly_day,
        created_by,
        status
      )
      VALUES (
        NEW.id,
        _invitation.program_template_id,
        _invitation.feature_access,
        COALESCE(_invitation.start_date, CURRENT_DATE),
        COALESCE(_invitation.measurement_day, 1),
        _invitation.created_by,
        'active'
      );
    END IF;

    IF _invitation.group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = _invitation.group_id
          AND user_id = NEW.id
      )
    THEN
      INSERT INTO public.group_members (group_id, user_id)
      VALUES (_invitation.group_id, NEW.id)
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;

    UPDATE public.email_invitations
    SET status = 'used',
        used_at = now(),
        used_by = NEW.id
    WHERE id = _invitation.id;
  ELSIF lower(NEW.email) = 'info@thegreekcarnivore.com' THEN
    PERFORM public.grant_profile_access_system(NEW.id, null);
  END IF;

  IF lower(NEW.email) = 'info@thegreekcarnivore.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
