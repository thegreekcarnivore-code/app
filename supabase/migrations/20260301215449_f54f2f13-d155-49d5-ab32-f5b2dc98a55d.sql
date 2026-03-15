
CREATE TABLE public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  link text DEFAULT NULL,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.client_notifications
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own notifications" ON public.client_notifications
  FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System and admins can insert notifications" ON public.client_notifications
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

CREATE INDEX idx_client_notifications_user_unread ON public.client_notifications (user_id, read_at) WHERE read_at IS NULL;
