ALTER TABLE public.program_messages
  ADD COLUMN IF NOT EXISTS send_hour integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS send_minute integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS also_send_email boolean NOT NULL DEFAULT false;