-- Remove critical results and open tasks from encounter closure block.
-- Critical results remain trackable and actionable, but no longer block finalization.
-- Open tasks can be completed post-discharge. Both blocks caused workflow friction.

CREATE OR REPLACE FUNCTION public.enforce_encounter_closure_requirements()
RETURNS TRIGGER AS $$
DECLARE
  unresolved_med_recs INTEGER := 0;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    IF COALESCE(NEW.final_diagnosis_code, '') = ''
      AND COALESCE(NEW.final_diagnosis_description, '') = '' THEN
      RAISE EXCEPTION 'Cannot finalize encounter without final diagnosis.';
    END IF;

    IF COALESCE(NEW.disposition_type, '') = '' THEN
      RAISE EXCEPTION 'Cannot finalize encounter without disposition.';
    END IF;

    IF NEW.disposition_type IN ('discharge', 'ama')
      AND (COALESCE(NEW.discharge_instructions, '') = '' OR COALESCE(NEW.return_precautions, '') = '') THEN
      RAISE EXCEPTION 'Discharge/AMA encounters require instructions and return precautions.';
    END IF;

    SELECT COUNT(*)
      INTO unresolved_med_recs
    FROM public.orders o
    WHERE o.encounter_id = NEW.id
      AND o.type = 'med'
      AND o.status <> 'discontinued'
      AND o.med_reconciled_at IS NULL;

    IF unresolved_med_recs > 0 THEN
      RAISE EXCEPTION 'Cannot finalize encounter with unresolved medication reconciliation (% meds).', unresolved_med_recs;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
