
-- Create reference_documents table for storing dietary guidelines and other reference texts
CREATE TABLE public.reference_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reference_documents ENABLE ROW LEVEL SECURITY;

-- Admin-only read access (edge functions use service role, so no policy needed for them)
CREATE POLICY "Admins can view reference documents"
  ON public.reference_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert reference documents"
  ON public.reference_documents FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reference documents"
  ON public.reference_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reference documents"
  ON public.reference_documents FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_reference_documents_updated_at
  BEFORE UPDATE ON public.reference_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
