CREATE TABLE public.policy_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  policy_version text NOT NULL DEFAULT '1.0',
  full_name text NOT NULL,
  signature_url text NOT NULL DEFAULT '',
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);

ALTER TABLE public.policy_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own policy signature"
  ON public.policy_signatures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own policy signature"
  ON public.policy_signatures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all policy signatures"
  ON public.policy_signatures FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));