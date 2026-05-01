-- Auto-write to member_journey_log from durable signal sources, so the
-- Σύμβουλος always has up-to-date context without us hand-writing summaries.
--
-- Triggers covered here (cheapest possible — pure SQL, no LLM in trigger path):
--   • measurement insert: detect weight loss vs. baseline, log milestone /
--                         observation rows.
--   • feedback insert:    log praise as milestone, complaint as struggle.
--   • weekly_reports:     log a one-line wrap-up using summary_for_journey_log.
--
-- Food-journal summarization is intentionally NOT a trigger — it runs as a
-- weekly cron via summarize-food-journal-weekly because it requires an LLM call.

-- ─── helper: insert a journey row safely (no-op if user_id missing) ─────────
CREATE OR REPLACE FUNCTION public.append_journey_log(
  p_user_id UUID,
  p_kind TEXT,
  p_summary TEXT,
  p_source TEXT,
  p_source_ref UUID,
  p_raw_excerpt TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_summary IS NULL OR length(p_summary) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.member_journey_log
    (user_id, kind, summary, source, source_ref, raw_excerpt, metadata)
  VALUES
    (p_user_id, p_kind, left(p_summary, 200), p_source, p_source_ref, p_raw_excerpt, p_metadata);
END;
$$;

-- ─── measurements → milestone / observation ────────────────────────────────
CREATE OR REPLACE FUNCTION public.journey_log_on_measurement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baseline NUMERIC;
  v_delta    NUMERIC;
  v_summary  TEXT;
  v_kind     TEXT;
BEGIN
  IF NEW.weight_kg IS NULL THEN
    RETURN NEW;
  END IF;

  -- Baseline = intake weight if present, otherwise the very first measurement.
  SELECT weight_kg INTO v_baseline
  FROM public.member_intakes
  WHERE user_id = NEW.user_id;

  IF v_baseline IS NULL THEN
    SELECT weight_kg INTO v_baseline
    FROM public.measurements
    WHERE user_id = NEW.user_id AND weight_kg IS NOT NULL
    ORDER BY measured_at ASC
    LIMIT 1;
  END IF;

  IF v_baseline IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := NEW.weight_kg - v_baseline;

  IF v_delta <= -3 THEN
    v_kind    := 'milestone';
    v_summary := format('Έχασε %s kg από το σημείο εκκίνησης (%s → %s).',
                        round(abs(v_delta)::numeric, 1),
                        round(v_baseline::numeric, 1),
                        round(NEW.weight_kg::numeric, 1));
  ELSIF v_delta <= -1 THEN
    v_kind    := 'observation';
    v_summary := format('Πρόοδος: %s kg κάτω από το σημείο εκκίνησης.',
                        round(abs(v_delta)::numeric, 1));
  ELSIF v_delta >= 1 THEN
    v_kind    := 'struggle';
    v_summary := format('Άνοδος βάρους: %s kg πάνω από το σημείο εκκίνησης.',
                        round(v_delta::numeric, 1));
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.append_journey_log(
    NEW.user_id,
    v_kind,
    v_summary,
    'measurement',
    NEW.id,
    NULL,
    jsonb_build_object('baseline_kg', v_baseline, 'current_kg', NEW.weight_kg, 'delta_kg', v_delta)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_log_on_measurement ON public.measurements;
CREATE TRIGGER trg_journey_log_on_measurement
AFTER INSERT ON public.measurements
FOR EACH ROW
EXECUTE FUNCTION public.journey_log_on_measurement();

-- ─── member_feedback → milestone / struggle ────────────────────────────────
CREATE OR REPLACE FUNCTION public.journey_log_on_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  IF NEW.category = 'praise' THEN
    v_kind := 'milestone';
  ELSIF NEW.category = 'complaint' THEN
    v_kind := 'struggle';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.append_journey_log(
    NEW.user_id,
    v_kind,
    left(NEW.message, 200),
    'feedback',
    NEW.id,
    left(NEW.message, 400),
    jsonb_build_object('category', NEW.category)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_log_on_feedback ON public.member_feedback;
CREATE TRIGGER trg_journey_log_on_feedback
AFTER INSERT ON public.member_feedback
FOR EACH ROW
EXECUTE FUNCTION public.journey_log_on_feedback();

-- ─── weekly_reports → observation ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.journey_log_on_weekly_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.summary_for_journey_log IS NULL OR length(NEW.summary_for_journey_log) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM public.append_journey_log(
    NEW.user_id,
    'observation',
    NEW.summary_for_journey_log,
    'weekly_report',
    NEW.id,
    NULL,
    jsonb_build_object('iso_year', NEW.iso_year, 'iso_week', NEW.iso_week)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_log_on_weekly_report ON public.weekly_reports;
CREATE TRIGGER trg_journey_log_on_weekly_report
AFTER INSERT ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.journey_log_on_weekly_report();
