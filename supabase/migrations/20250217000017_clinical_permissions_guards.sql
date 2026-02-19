-- RBAC guards for new clinical foundation actions.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_provider_role(role_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT role_value IN (
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician',
    'medical_doctor',
    'resident_physician',
    'nurse_practitioner',
    'physician_assistant'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinical_staff_role(role_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT role_value IN (
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician',
    'medical_doctor',
    'resident_physician',
    'nurse_practitioner',
    'physician_assistant',
    'registered_nurse',
    'nurse',
    'licensed_practical_nurse',
    'radiologist',
    'pharmacist',
    'lab_technician',
    'respiratory_therapist',
    'physical_therapist'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_result_ack_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_app_role();

  IF (
    NEW.acknowledgment_status IS DISTINCT FROM OLD.acknowledgment_status
    OR NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by
    OR NEW.actioned_by IS DISTINCT FROM OLD.actioned_by
  ) AND NOT public.is_clinical_staff_role(actor_role) THEN
    RAISE EXCEPTION 'Role (%) cannot acknowledge/action results.', COALESCE(actor_role, 'unknown');
  END IF;

  IF NEW.type = 'procedure'
    AND NEW.status = 'final'
    AND COALESCE(OLD.status, '') <> 'final'
    AND NOT public.is_provider_role(actor_role) THEN
    RAISE EXCEPTION 'Role (%) cannot finalize procedure notes.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_result_ack_permissions_trigger ON public.results;
CREATE TRIGGER enforce_result_ack_permissions_trigger
  BEFORE UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_result_ack_permissions();

CREATE OR REPLACE FUNCTION public.enforce_disposition_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_app_role();

  IF (
    NEW.disposition_type IS DISTINCT FROM OLD.disposition_type
    OR NEW.discharge_instructions IS DISTINCT FROM OLD.discharge_instructions
    OR NEW.return_precautions IS DISTINCT FROM OLD.return_precautions
    OR NEW.follow_up_destination IS DISTINCT FROM OLD.follow_up_destination
  ) AND NOT public.is_provider_role(actor_role) THEN
    RAISE EXCEPTION 'Role (%) cannot set disposition.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_disposition_permissions_trigger ON public.encounters;
CREATE TRIGGER enforce_disposition_permissions_trigger
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_disposition_permissions();

CREATE OR REPLACE FUNCTION public.enforce_handoff_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_app_role();
  IF NOT public.is_clinical_staff_role(actor_role) THEN
    RAISE EXCEPTION 'Role (%) cannot create/complete handoffs.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_handoff_permissions_insert_trigger ON public.encounter_handoffs;
CREATE TRIGGER enforce_handoff_permissions_insert_trigger
  BEFORE INSERT ON public.encounter_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_handoff_permissions();

DROP TRIGGER IF EXISTS enforce_handoff_permissions_update_trigger ON public.encounter_handoffs;
CREATE TRIGGER enforce_handoff_permissions_update_trigger
  BEFORE UPDATE ON public.encounter_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_handoff_permissions();

CREATE OR REPLACE FUNCTION public.enforce_note_cosign_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_app_role();

  IF NEW.cosign_status = 'co_signed'
    AND COALESCE(OLD.cosign_status, '') <> 'co_signed'
    AND NOT public.is_provider_role(actor_role) THEN
    RAISE EXCEPTION 'Role (%) cannot co-sign notes.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_note_cosign_permissions_trigger ON public.clinical_notes;
CREATE TRIGGER enforce_note_cosign_permissions_trigger
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_note_cosign_permissions();

CREATE OR REPLACE FUNCTION public.enforce_adverse_event_review_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.current_app_role();

  IF (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
  ) AND actor_role NOT IN (
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician'
  ) THEN
    RAISE EXCEPTION 'Role (%) cannot review/close adverse events.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_adverse_event_review_permissions_trigger ON public.adverse_events;
CREATE TRIGGER enforce_adverse_event_review_permissions_trigger
  BEFORE UPDATE ON public.adverse_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_adverse_event_review_permissions();
