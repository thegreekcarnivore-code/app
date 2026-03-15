
-- Create client_programs table (admin-only management)
CREATE TABLE public.client_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_name TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  installments_total INTEGER NOT NULL DEFAULT 1,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  agreement_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_programs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all client programs"
  ON public.client_programs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client programs"
  ON public.client_programs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client programs"
  ON public.client_programs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client programs"
  ON public.client_programs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Client can view their own program start_date only (for chart marker)
CREATE POLICY "Users can view own programs"
  ON public.client_programs FOR SELECT
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_client_programs_updated_at
  BEFORE UPDATE ON public.client_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
