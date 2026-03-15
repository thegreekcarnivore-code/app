
-- Finance entries table
CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  category text NOT NULL DEFAULT 'Other',
  description text NOT NULL DEFAULT '',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage finance entries"
  ON public.finance_entries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Finance categories table
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'both',
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage finance categories"
  ON public.finance_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Finance settings table
CREATE TABLE public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL UNIQUE,
  google_sheet_id text,
  google_sheet_tab text DEFAULT 'Finance',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage finance settings"
  ON public.finance_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated at trigger for finance_entries
CREATE TRIGGER update_finance_entries_updated_at
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('finance-receipts', 'finance-receipts', false);

-- Storage RLS for finance-receipts bucket
CREATE POLICY "Admins can upload finance receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'finance-receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view finance receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'finance-receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete finance receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'finance-receipts' AND has_role(auth.uid(), 'admin'::app_role));
