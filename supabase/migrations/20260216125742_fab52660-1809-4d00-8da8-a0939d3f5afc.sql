-- Prevent users from modifying the 'approved' field on their own profile
-- Replace the user self-update policy with one that blocks changes to 'approved'
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a trigger that prevents non-admins from changing the approved field
CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If the approved field is being changed and the user is not an admin, block it
  IF NEW.approved IS DISTINCT FROM OLD.approved THEN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.approved := OLD.approved; -- Revert the change
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_self_approval_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_approval();

-- Re-add the user update policy
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
