
-- Add feature_access column to invite_tokens
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS feature_access jsonb NOT NULL DEFAULT '{"travel": true, "explore": true, "delivery": true, "shopping": true, "concierge": true, "resources": true, "measurements": true, "video_library": true, "community": true}'::jsonb;

-- Update use_invite_token to also set feature_access from the token
CREATE OR REPLACE FUNCTION public.use_invite_token(_token text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _token_row record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only use token for your own account';
  END IF;

  SELECT * INTO _token_row FROM public.invite_tokens
  WHERE token = _token AND used_by IS NULL AND expires_at > now();
  
  IF _token_row IS NULL THEN
    RETURN false;
  END IF;
  
  UPDATE public.invite_tokens SET used_by = _user_id, used_at = now() WHERE id = _token_row.id;
  UPDATE public.profiles SET approved = true, feature_access = _token_row.feature_access WHERE id = _user_id;
  RETURN true;
END;
$$;
