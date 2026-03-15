
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  service text NOT NULL,
  model text,
  estimated_cost numeric NOT NULL DEFAULT 0,
  call_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all api usage"
  ON public.api_usage FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_api_usage(
  _user_id uuid,
  _function_name text,
  _service text,
  _model text,
  _estimated_cost numeric,
  _call_count integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.api_usage (user_id, function_name, service, model, estimated_cost, call_count)
  VALUES (_user_id, _function_name, _service, _model, _estimated_cost, _call_count);
END;
$$;
