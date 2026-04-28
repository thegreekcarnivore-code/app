-- Audit fixes — 2026-04-21
--
-- Three issues found by the read-only DB audit:
--   1. Duplicate AFTER INSERT triggers on `measurements` (`on_measurement_notify_admin`
--      from migration 20260303205604 + `trg_notify_admin_measurement` from earlier
--      migration 20260303133007). Both call `notify_admin_on_measurement()`, so
--      every weight log produces TWO admin bell notifications.
--   2. Same duplicate situation on `progress_photos` (`on_photo_notify_admin`
--      + `trg_notify_admin_photo`).
--   3. The `on_client_message_notify_admin` trigger defined in migration
--      20260303210031 isn't currently active on the live DB, so client →
--      admin messages don't surface a bell notification for the admin.
--
-- The fix drops the older `trg_*` duplicates (keeps the well-named `on_*`
-- versions from the more deliberate later migrations) and recreates the
-- missing message trigger using the function `notify_admin_on_client_message`,
-- which already exists in the database.
--
-- All operations are idempotent (`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
-- after a defensive drop). No data is touched, no functions modified.

-- 1. Remove duplicate trigger on measurements
DROP TRIGGER IF EXISTS trg_notify_admin_measurement ON public.measurements;

-- 2. Remove duplicate trigger on progress_photos
DROP TRIGGER IF EXISTS trg_notify_admin_photo ON public.progress_photos;

-- 3. Restore client → admin message bell notification trigger
DROP TRIGGER IF EXISTS on_client_message_notify_admin ON public.messages;
CREATE TRIGGER on_client_message_notify_admin
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_client_message();
