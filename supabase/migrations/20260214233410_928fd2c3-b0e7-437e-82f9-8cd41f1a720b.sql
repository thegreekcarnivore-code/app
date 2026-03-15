-- Remove the dangerous policy that allows anyone to read valid invite tokens
-- Token validation is handled securely via the use_invite_token() RPC function
DROP POLICY IF EXISTS "Anyone can read valid tokens" ON public.invite_tokens;