
CREATE OR REPLACE FUNCTION public.notify_client_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
BEGIN
  SELECT has_role(NEW.sender_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_notifications (user_id, type, title, body, link)
  VALUES (
    NEW.receiver_id,
    'new_message',
    'Εχεις μηνυμα απο τον coach σου τον Αλεξανδρο',
    LEFT(COALESCE(NEW.content, 'Ηχητικο μηνυμα'), 100),
    '/home'
  );

  RETURN NEW;
END;
$function$;
