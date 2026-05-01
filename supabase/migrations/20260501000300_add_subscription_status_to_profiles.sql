-- Subscription state tracked on profiles so SubscriptionGate can do a single fast lookup.
-- Stripe webhook flips these on payment_failed / payment_succeeded / subscription_updated.
-- Also adds the once-per-week weekly-analysis acknowledgement + last-generated timestamps.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weekly_analysis_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weekly_analysis_last_generated_at TIMESTAMPTZ;

-- Allowed values: active | past_due | canceled | trialing | unpaid
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing', 'unpaid'));

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON public.profiles (subscription_status);
