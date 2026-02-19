-- Auto-remove claimed patients from quick-claim lists when care transitions complete.
-- 1) Encounter discharged/completed -> unpin for all users on that patient.
-- 2) Handoff completed -> unpin for the handing-off clinician (from_user_id).

CREATE OR REPLACE FUNCTION public.unpin_claimed_patient_on_encounter_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    UPDATE public.recent_patients
    SET
      is_pinned = FALSE,
      viewed_at = NOW()
    WHERE patient_id = NEW.patient_id
      AND is_pinned = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS unpin_claimed_patient_on_encounter_completion_trigger ON public.encounters;
CREATE TRIGGER unpin_claimed_patient_on_encounter_completion_trigger
AFTER UPDATE ON public.encounters
FOR EACH ROW
EXECUTE FUNCTION public.unpin_claimed_patient_on_encounter_completion();

CREATE OR REPLACE FUNCTION public.unpin_claimed_patient_on_handoff_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    UPDATE public.recent_patients
    SET
      is_pinned = FALSE,
      viewed_at = NOW()
    WHERE patient_id = NEW.patient_id
      AND user_id = NEW.from_user_id
      AND is_pinned = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS unpin_claimed_patient_on_handoff_completion_trigger ON public.encounter_handoffs;
CREATE TRIGGER unpin_claimed_patient_on_handoff_completion_trigger
AFTER UPDATE ON public.encounter_handoffs
FOR EACH ROW
EXECUTE FUNCTION public.unpin_claimed_patient_on_handoff_completion();
