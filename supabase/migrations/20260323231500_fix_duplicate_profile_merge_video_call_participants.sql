CREATE OR REPLACE FUNCTION public._merge_duplicate_profiles(_source_user_id uuid, _target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _source_profile public.profiles%ROWTYPE;
  _target_profile public.profiles%ROWTYPE;
  _source_has_auth boolean;
  _target_has_auth boolean;
  _source_enrollment record;
  _source_weekly_check_in record;
  _target_enrollment_id uuid;
  _target_weekly_check_in_id uuid;
BEGIN
  IF _source_user_id IS NULL OR _target_user_id IS NULL OR _source_user_id = _target_user_id THEN
    RAISE EXCEPTION 'Invalid duplicate profile merge request';
  END IF;

  SELECT *
  INTO _source_profile
  FROM public.profiles
  WHERE id = _source_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source profile % not found', _source_user_id;
  END IF;

  SELECT *
  INTO _target_profile
  FROM public.profiles
  WHERE id = _target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile % not found', _target_user_id;
  END IF;

  IF _source_profile.email IS NULL OR _target_profile.email IS NULL OR lower(_source_profile.email) <> lower(_target_profile.email) THEN
    RAISE EXCEPTION 'Profiles must share the same email to be merged';
  END IF;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = _source_user_id) INTO _source_has_auth;
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = _target_user_id) INTO _target_has_auth;

  IF NOT _target_has_auth THEN
    RAISE EXCEPTION 'Target profile must be auth-linked';
  END IF;

  IF _source_has_auth THEN
    RAISE EXCEPTION 'Source profile must be the legacy non-auth profile';
  END IF;

  FOR _source_enrollment IN
    SELECT *
    FROM public.client_program_enrollments
    WHERE user_id = _source_user_id
    ORDER BY created_at ASC
  LOOP
    SELECT id
    INTO _target_enrollment_id
    FROM public.client_program_enrollments
    WHERE user_id = _target_user_id
      AND program_template_id = _source_enrollment.program_template_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF _target_enrollment_id IS NULL THEN
      UPDATE public.client_program_enrollments
      SET user_id = _target_user_id
      WHERE id = _source_enrollment.id;
    ELSE
      UPDATE public.client_tasks
      SET enrollment_id = _target_enrollment_id
      WHERE enrollment_id = _source_enrollment.id;

      UPDATE public.client_video_progress
      SET enrollment_id = _target_enrollment_id
      WHERE enrollment_id = _source_enrollment.id;

      UPDATE public.weekly_check_ins
      SET enrollment_id = _target_enrollment_id
      WHERE enrollment_id = _source_enrollment.id;

      UPDATE public.client_form_signatures
      SET enrollment_id = _target_enrollment_id
      WHERE enrollment_id = _source_enrollment.id;

      DELETE FROM public.client_program_enrollments
      WHERE id = _source_enrollment.id;
    END IF;
  END LOOP;

  INSERT INTO public.client_category_assignments (user_id, category_id)
  SELECT _target_user_id, category_id
  FROM public.client_category_assignments
  WHERE user_id = _source_user_id
  ON CONFLICT (user_id, category_id) DO NOTHING;
  DELETE FROM public.client_category_assignments WHERE user_id = _source_user_id;

  INSERT INTO public.group_members (group_id, user_id)
  SELECT group_id, _target_user_id
  FROM public.group_members
  WHERE user_id = _source_user_id
  ON CONFLICT (group_id, user_id) DO NOTHING;
  DELETE FROM public.group_members WHERE user_id = _source_user_id;

  INSERT INTO public.group_post_likes (post_id, user_id)
  SELECT post_id, _target_user_id
  FROM public.group_post_likes
  WHERE user_id = _source_user_id
  ON CONFLICT (post_id, user_id) DO NOTHING;
  DELETE FROM public.group_post_likes WHERE user_id = _source_user_id;

  INSERT INTO public.health_integrations (user_id, provider, access_token, refresh_token, connected_at, token_expires_at, created_at, updated_at)
  SELECT _target_user_id, provider, access_token, refresh_token, connected_at, token_expires_at, created_at, updated_at
  FROM public.health_integrations
  WHERE user_id = _source_user_id
  ON CONFLICT (user_id, provider) DO NOTHING;
  DELETE FROM public.health_integrations WHERE user_id = _source_user_id;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
  SELECT _target_user_id, endpoint, p256dh, auth, created_at
  FROM public.push_subscriptions
  WHERE user_id = _source_user_id
  ON CONFLICT (user_id, endpoint) DO NOTHING;
  DELETE FROM public.push_subscriptions WHERE user_id = _source_user_id;

  INSERT INTO public.recipe_favorites (user_id, recipe_id, created_at)
  SELECT _target_user_id, recipe_id, created_at
  FROM public.recipe_favorites
  WHERE user_id = _source_user_id
  ON CONFLICT (user_id, recipe_id) DO NOTHING;
  DELETE FROM public.recipe_favorites WHERE user_id = _source_user_id;

  INSERT INTO public.user_roles (user_id, role)
  SELECT _target_user_id, role
  FROM public.user_roles
  WHERE user_id = _source_user_id
  ON CONFLICT (user_id, role) DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = _source_user_id;

  INSERT INTO public.video_call_participants (video_call_id, user_id, created_at)
  SELECT video_call_id, _target_user_id, created_at
  FROM public.video_call_participants
  WHERE user_id = _source_user_id
  ON CONFLICT (video_call_id, user_id) DO NOTHING;
  DELETE FROM public.video_call_participants WHERE user_id = _source_user_id;

  FOR _source_weekly_check_in IN
    SELECT *
    FROM public.weekly_check_ins
    WHERE user_id = _source_user_id
    ORDER BY created_at ASC
  LOOP
    SELECT id
    INTO _target_weekly_check_in_id
    FROM public.weekly_check_ins
    WHERE user_id = _target_user_id
      AND week_end = _source_weekly_check_in.week_end
    ORDER BY created_at ASC
    LIMIT 1;

    IF _target_weekly_check_in_id IS NULL THEN
      UPDATE public.weekly_check_ins
      SET user_id = _target_user_id
      WHERE id = _source_weekly_check_in.id;
    ELSE
      UPDATE public.weekly_check_ins
      SET enrollment_id = COALESCE(public.weekly_check_ins.enrollment_id, _source_weekly_check_in.enrollment_id),
          week_start = COALESCE(public.weekly_check_ins.week_start, _source_weekly_check_in.week_start),
          due_at = COALESCE(public.weekly_check_ins.due_at, _source_weekly_check_in.due_at),
          generated_at = COALESCE(public.weekly_check_ins.generated_at, _source_weekly_check_in.generated_at),
          language = COALESCE(NULLIF(public.weekly_check_ins.language, ''), _source_weekly_check_in.language),
          status = COALESCE(NULLIF(public.weekly_check_ins.status, ''), _source_weekly_check_in.status),
          summary = COALESCE(NULLIF(public.weekly_check_ins.summary, ''), _source_weekly_check_in.summary),
          report_content = COALESCE(NULLIF(public.weekly_check_ins.report_content, ''), _source_weekly_check_in.report_content),
          coach_message = COALESCE(NULLIF(public.weekly_check_ins.coach_message, ''), _source_weekly_check_in.coach_message),
          data_snapshot = COALESCE(public.weekly_check_ins.data_snapshot, _source_weekly_check_in.data_snapshot)
      WHERE id = _target_weekly_check_in_id;

      DELETE FROM public.weekly_check_ins
      WHERE id = _source_weekly_check_in.id;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.user_activity WHERE user_id = _source_user_id) THEN
    IF EXISTS (SELECT 1 FROM public.user_activity WHERE user_id = _target_user_id) THEN
      UPDATE public.user_activity
      SET action_count = COALESCE(public.user_activity.action_count, 0) + COALESCE(source_row.action_count, 0),
          last_inquiry_at = CASE
            WHEN public.user_activity.last_inquiry_at IS NULL THEN source_row.last_inquiry_at
            WHEN source_row.last_inquiry_at IS NULL THEN public.user_activity.last_inquiry_at
            ELSE GREATEST(public.user_activity.last_inquiry_at, source_row.last_inquiry_at)
          END
      FROM public.user_activity AS source_row
      WHERE public.user_activity.user_id = _target_user_id
        AND source_row.user_id = _source_user_id;

      DELETE FROM public.user_activity
      WHERE user_id = _source_user_id;
    ELSE
      UPDATE public.user_activity
      SET user_id = _target_user_id
      WHERE user_id = _source_user_id;
    END IF;
  END IF;

  UPDATE public.admin_tasks SET client_id = _target_user_id WHERE client_id = _source_user_id;
  UPDATE public.ai_chat_messages SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.api_usage SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_form_signatures SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_notes SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_notifications SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_programs SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_tasks SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.client_video_progress SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.food_journal SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.group_comments SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.group_posts SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.measurement_comments SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.measurements SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.messages SET sender_id = _target_user_id WHERE sender_id = _source_user_id;
  UPDATE public.messages SET receiver_id = _target_user_id WHERE receiver_id = _source_user_id;
  UPDATE public.policy_signatures SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.progress_photos SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.recommendation_history SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.report_feedback SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.report_instructions SET user_id = _target_user_id WHERE user_id = _source_user_id;
  UPDATE public.wellness_journal SET user_id = _target_user_id WHERE user_id = _source_user_id;

  UPDATE public.profiles
  SET approved = COALESCE(_target_profile.approved, false) OR COALESCE(_source_profile.approved, false),
      feature_access = public.merge_feature_access_json(_target_profile.feature_access, _source_profile.feature_access),
      display_name = COALESCE(NULLIF(_target_profile.display_name, ''), NULLIF(_source_profile.display_name, '')),
      height_cm = COALESCE(_target_profile.height_cm, _source_profile.height_cm),
      sex = COALESCE(NULLIF(_target_profile.sex, ''), NULLIF(_source_profile.sex, '')),
      date_of_birth = COALESCE(_target_profile.date_of_birth, _source_profile.date_of_birth),
      language = COALESCE(NULLIF(_target_profile.language, ''), NULLIF(_source_profile.language, ''), 'el'),
      timezone = COALESCE(NULLIF(_target_profile.timezone, ''), NULLIF(_source_profile.timezone, '')),
      vocative_name_el = COALESCE(NULLIF(_target_profile.vocative_name_el, ''), NULLIF(_source_profile.vocative_name_el, '')),
      avatar_url = COALESCE(NULLIF(_target_profile.avatar_url, ''), NULLIF(_source_profile.avatar_url, '')),
      onboarding_tour_completed = COALESCE(_target_profile.onboarding_tour_completed, false) OR COALESCE(_source_profile.onboarding_tour_completed, false),
      stripe_customer_id = COALESCE(NULLIF(_target_profile.stripe_customer_id, ''), NULLIF(_source_profile.stripe_customer_id, '')),
      last_login_at = CASE
        WHEN _target_profile.last_login_at IS NULL THEN _source_profile.last_login_at
        WHEN _source_profile.last_login_at IS NULL THEN _target_profile.last_login_at
        ELSE GREATEST(_target_profile.last_login_at, _source_profile.last_login_at)
      END,
      email = COALESCE(_target_profile.email, _source_profile.email)
  WHERE id = _target_user_id;

  DELETE FROM public.profiles
  WHERE id = _source_user_id;

  RETURN jsonb_build_object(
    'merged', true,
    'email', lower(_target_profile.email),
    'target_profile_id', _target_user_id,
    'source_profile_id', _source_user_id
  );
END;
$function$;
