CREATE TABLE IF NOT EXISTS public.app_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  purpose text NOT NULL CHECK (purpose IN ('magic_login', 'password_reset')),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  language text,
  redirect_path text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);

ALTER TABLE public.app_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage app access links" ON public.app_access_links;
CREATE POLICY "Admins can manage app access links"
ON public.app_access_links
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.app_access_links FROM anon;
REVOKE ALL ON public.app_access_links FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_access_links TO service_role;
