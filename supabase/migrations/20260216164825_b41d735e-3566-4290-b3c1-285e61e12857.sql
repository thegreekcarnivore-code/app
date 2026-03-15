CREATE OR REPLACE FUNCTION public.use_invite_token(_token text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token_id uuid;
BEGIN
  -- SECURITY: Verify caller is the user being approved
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only use token for your own account';
  END IF;

  SELECT id INTO _token_id FROM public.invite_tokens
  WHERE token = _token AND used_by IS NULL AND expires_at > now();
  
  IF _token_id IS NULL THEN
    RETURN false;
  END IF;
  
  UPDATE public.invite_tokens SET used_by = _user_id, used_at = now() WHERE id = _token_id;
  UPDATE public.profiles SET approved = true WHERE id = _user_id;
  RETURN true;
END;
$$;