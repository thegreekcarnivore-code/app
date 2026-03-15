ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS sex text NULL;