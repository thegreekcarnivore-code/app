
-- Admin notification preferences
CREATE TABLE public.admin_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL UNIQUE,
  notify_weight boolean NOT NULL DEFAULT true,
  notify_photos boolean NOT NULL DEFAULT true,
  notify_late boolean NOT NULL DEFAULT true,
  late_threshold_days integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own prefs"
ON public.admin_notification_prefs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger: notify admin when a client submits a weight measurement
CREATE OR REPLACE FUNCTION public.notify_admin_on_measurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid;
  _client_name text;
  _prefs record;
BEGIN
  -- Only for non-admin users
  SELECT user_id INTO _admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF _admin_id IS NULL OR NEW.user_id = _admin_id THEN
    RETURN NEW;
  END IF;

  -- Check admin prefs
  SELECT * INTO _prefs FROM public.admin_notification_prefs WHERE admin_id = _admin_id;
  IF _prefs IS NOT NULL AND _prefs.notify_weight = false THEN
    RETURN NEW;
  END IF;

  -- Only notify if weight was logged
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
    '/admin/client/' || NEW.user_id || '/data'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_measurement
AFTER INSERT ON public.measurements
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_measurement();

-- Trigger: notify admin when a client uploads a progress photo
CREATE OR REPLACE FUNCTION public.notify_admin_on_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    '/admin/client/' || NEW.user_id || '/data?tab=photos'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_photo
AFTER INSERT ON public.progress_photos
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_photo();
