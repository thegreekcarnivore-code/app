-- Explicitly revoke all table permissions from the anon role
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.invite_tokens FROM anon;
