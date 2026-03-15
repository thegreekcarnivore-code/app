
CREATE OR REPLACE FUNCTION public.notify_admin_on_measurement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _client_name text;
  _prefs record;
BEGIN
  SELECT user_id INTO _admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF _admin_id IS NULL OR NEW.user_id = _admin_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _prefs FROM public.admin_notification_prefs WHERE admin_id = _admin_id;
  IF _prefs IS NOT NULL AND _prefs.notify_weight = false THEN
    RETURN NEW;
  END IF;

  IF NEW.weight_kg IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, split_part(email, '@', 1), 'Client') INTO _client_name
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.client_notifications (user_id, type, title, body, link)
  VALUES (
    _admin_id,
    'client_measurement',
    _client_name || ' logged weight',
    _client_name || ' recorded ' || NEW.weight_kg || 'kg',
    '/admin/client/' || NEW.user_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _client_name text;
  _prefs record;
BEGIN
  SELECT user_id INTO _admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF _admin_id IS NULL OR NEW.user_id = _admin_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _prefs FROM public.admin_notification_prefs WHERE admin_id = _admin_id;
  IF _prefs IS NOT NULL AND _prefs.notify_photos = false THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, split_part(email, '@', 1), 'Client') INTO _client_name
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.client_notifications (user_id, type, title, body, link)
  VALUES (
    _admin_id,
    'client_photo',
    _client_name || ' uploaded a progress photo',
    _client_name || ' added a new ' || NEW.angle || ' photo',
    '/admin/client/' || NEW.user_id
  );

  RETURN NEW;
END;
$function$;

-- Also fix existing notifications with /data links
UPDATE public.client_notifications
SET link = regexp_replace(link, '/data(\?.*)?$', '\1')
WHERE link LIKE '%/data%';
