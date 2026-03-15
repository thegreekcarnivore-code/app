-- Add PERMISSIVE base policies that require authentication
-- These ensure anonymous users are blocked, while RESTRICTIVE policies further narrow access

-- Profiles: only authenticated users can SELECT
CREATE POLICY "Authenticated users only - profiles select"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- User roles: only authenticated users can SELECT  
CREATE POLICY "Authenticated users only - user_roles select"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Invite tokens: only authenticated users can SELECT
CREATE POLICY "Authenticated users only - invite_tokens select"
ON public.invite_tokens
FOR SELECT
TO authenticated
USING (true);
