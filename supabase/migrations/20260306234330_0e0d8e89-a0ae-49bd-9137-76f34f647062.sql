
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.client_programs 
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
