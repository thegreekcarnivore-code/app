
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_tour_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
