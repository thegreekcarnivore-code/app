
-- Update handle_new_user to auto-approve and assign admin for info@thegreekcarnivore.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, approved)
  VALUES (NEW.id, NEW.email, CASE WHEN NEW.email = 'info@thegreekcarnivore.com' THEN true ELSE false END);
  
  -- Auto-assign admin role for the owner
  IF NEW.email = 'info@thegreekcarnivore.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
