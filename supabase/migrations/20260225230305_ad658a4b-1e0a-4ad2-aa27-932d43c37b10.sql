
ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS right_arm_cm numeric,
  ADD COLUMN IF NOT EXISTS left_arm_cm numeric,
  ADD COLUMN IF NOT EXISTS right_leg_cm numeric,
  ADD COLUMN IF NOT EXISTS left_leg_cm numeric;

-- Migrate existing data from arm_cm/leg_cm to right columns
UPDATE public.measurements SET right_arm_cm = arm_cm WHERE arm_cm IS NOT NULL AND right_arm_cm IS NULL;
UPDATE public.measurements SET right_leg_cm = leg_cm WHERE leg_cm IS NOT NULL AND right_leg_cm IS NULL;
