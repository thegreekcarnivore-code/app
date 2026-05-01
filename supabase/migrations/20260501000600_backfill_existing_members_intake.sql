-- Backfill: mark every currently-enrolled member as having completed the intake,
-- so IntakeGate does NOT prompt existing members. Only new enrollees from this
-- migration onward will see the intake form.
--
-- raw_payload.backfilled = true lets us identify these later (e.g. to invite
-- them to fill the intake voluntarily through a separate, non-blocking flow).

INSERT INTO public.member_intakes (user_id, completed_at, raw_payload)
SELECT DISTINCT
  cpe.user_id,
  now(),
  jsonb_build_object('backfilled', true, 'backfilled_at', now())
FROM public.client_program_enrollments cpe
JOIN public.profiles p ON p.id = cpe.user_id
WHERE cpe.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
