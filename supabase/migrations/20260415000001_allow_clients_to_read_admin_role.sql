-- Clients need to read the admin's user_id from user_roles in order to open
-- the chat. The existing "Users can view their own roles" policy only returns
-- the client's own row, so adminId is never resolved and ChatBubble renders null.
-- Fix: allow any authenticated user to SELECT rows where role = 'admin'.

CREATE POLICY "Anyone can find admin user_id"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (role = 'admin');
