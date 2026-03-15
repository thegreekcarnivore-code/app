
ALTER TABLE public.email_invitations
  DROP COLUMN measurement_date,
  ADD COLUMN measurement_day integer DEFAULT NULL;
