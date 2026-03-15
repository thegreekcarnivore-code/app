
-- Create user_activity table for tracking usage
CREATE TABLE public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  action_count integer NOT NULL DEFAULT 0,
  last_inquiry_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Admin can view all activity
CREATE POLICY "Admins can view all activity"
ON public.user_activity
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
ON public.user_activity
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create function to increment activity (called from edge functions with service role)
CREATE OR REPLACE FUNCTION public.increment_user_activity(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_activity (user_id, action_count, last_inquiry_at)
  VALUES (_user_id, 1, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    action_count = user_activity.action_count + 1,
    last_inquiry_at = now();
END;
$$;
