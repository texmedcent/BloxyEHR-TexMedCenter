-- Allow hospital managers to force end encounters, bypassing normal closure requirements.
-- When a hospital_manager sets status=completed, we apply minimal required fields and skip validation.

CREATE OR REPLACE FUNCTION public.enforce_encounter_closure_requirements()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  unresolved_med_recs INTEGER := 0;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    -- Hospital managers can force end; set minimal fields and skip validation
    SELECT p.role INTO actor_role FROM public.profiles p WHERE p.id = auth.uid();
    IF actor_role = 'hospital_manager' THEN
      NEW.disposition_type := COALESCE(NULLIF(TRIM(NEW.disposition_type), ''), 'transfer');
      NEW.final_diagnosis_description := COALESCE(NULLIF(TRIM(NEW.final_diagnosis_description), ''), 'Administratively closed by manager');
      NEW.discharge_instructions := COALESCE(NULLIF(TRIM(NEW.discharge_instructions), ''), 'Administratively closed.');
      NEW.return_precautions := COALESCE(NULLIF(TRIM(NEW.return_precautions), ''), 'N/A');
      IF NEW.discharge_date IS NULL THEN
        NEW.discharge_date := NOW();
      END IF;
      RETURN NEW;
    END IF;

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
