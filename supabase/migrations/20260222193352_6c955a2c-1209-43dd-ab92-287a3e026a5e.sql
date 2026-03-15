
-- Create messages table for admin-client conversations
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages (sender_id must be their own)
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (for read receipts)
CREATE POLICY "Users can mark received messages as read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can send messages
CREATE POLICY "Admins can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update messages
CREATE POLICY "Admins can update messages"
  ON public.messages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Index for fast conversation lookups
CREATE INDEX idx_messages_conversation ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_messages_receiver_unread ON public.messages (receiver_id, read_at) WHERE read_at IS NULL;
