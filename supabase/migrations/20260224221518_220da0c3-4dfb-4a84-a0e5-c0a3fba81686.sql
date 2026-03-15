
ALTER TABLE public.email_invitations
  ADD COLUMN start_date date DEFAULT CURRENT_DATE,
  ADD COLUMN measurement_date date;
