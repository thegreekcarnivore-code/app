
-- Drop all existing restrictive policies on policy_signatures
DROP POLICY IF EXISTS "Admins can view all policy signatures" ON public.policy_signatures;
DROP POLICY IF EXISTS "Users can insert own policy signature" ON public.policy_signatures;
DROP POLICY IF EXISTS "Users can view own policy signature" ON public.policy_signatures;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can view all policy signatures"
  ON public.policy_signatures FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own policy signature"
  ON public.policy_signatures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own policy signature"
  ON public.policy_signatures FOR INSERT
  WITH CHECK (auth.uid() = user_id);
