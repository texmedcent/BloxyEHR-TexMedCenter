-- Expand patient audit trail coverage across newer EHR modules.
-- Logs INSERT/UPDATE/DELETE actions for patient-centric and encounter-centric workflows.

CREATE OR REPLACE FUNCTION public.log_patient_table_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_id UUID;
  v_actor UUID;
  v_actor_name TEXT;
  v_changed_fields JSONB;
  v_old JSONB;
  v_new JSONB;
  v_record_id TEXT;
  v_action TEXT;
  v_encounter_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_old := NULL;
    v_action := 'insert';
  ELSIF TG_OP = 'UPDATE' THEN
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_action := 'update';
  ELSE
    v_new := NULL;
    v_old := to_jsonb(OLD);
    v_action := 'delete';
  END IF;

  IF TG_TABLE_NAME = 'patients' THEN
    v_patient_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  ELSIF TG_TABLE_NAME = 'encounters' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'clinical_notes' THEN
    v_encounter_id := COALESCE((v_new->>'encounter_id')::uuid, (v_old->>'encounter_id')::uuid);
    SELECT e.patient_id INTO v_patient_id
    FROM public.encounters e
    WHERE e.id = v_encounter_id
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'results' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'vital_signs' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'patient_problems' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'patient_checkins' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'appointments' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'med_admin_log' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'nursing_flowsheets' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'encounter_handoffs' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'adverse_events' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'in_basket_tasks' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'recent_patients' THEN
    v_patient_id := COALESCE((v_new->>'patient_id')::uuid, (v_old->>'patient_id')::uuid);
  ELSIF TG_TABLE_NAME = 'encounter_audit_log' THEN
    v_encounter_id := COALESCE((v_new->>'encounter_id')::uuid, (v_old->>'encounter_id')::uuid);
    SELECT e.patient_id INTO v_patient_id
    FROM public.encounters e
    WHERE e.id = v_encounter_id
    LIMIT 1;
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor
    LIMIT 1;
  END IF;

  IF v_action = 'update' THEN
    SELECT COALESCE(jsonb_agg(n.key), '[]'::jsonb)
      INTO v_changed_fields
    FROM jsonb_each(v_new) n
    LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value;
  ELSIF v_action = 'insert' THEN
    SELECT COALESCE(jsonb_agg(key), '[]'::jsonb)
      INTO v_changed_fields
    FROM jsonb_object_keys(v_new) key;
  ELSE
    SELECT COALESCE(jsonb_agg(key), '[]'::jsonb)
      INTO v_changed_fields
    FROM jsonb_object_keys(v_old) key;
  END IF;

  v_record_id := COALESCE(v_new->>'id', v_old->>'id', 'unknown');

  INSERT INTO public.patient_audit_log (
    patient_id,
    table_name,
    record_id,
    action,
    changed_fields,
    old_data,
    new_data,
    performed_by,
    performed_by_name
  ) VALUES (
    v_patient_id,
    TG_TABLE_NAME,
    v_record_id,
    v_action,
    v_changed_fields,
    v_old,
    v_new,
    v_actor,
    COALESCE(v_actor_name, 'System')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_nursing_flowsheets_changes ON public.nursing_flowsheets;
CREATE TRIGGER audit_nursing_flowsheets_changes
AFTER INSERT OR UPDATE OR DELETE ON public.nursing_flowsheets
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_encounter_handoffs_changes ON public.encounter_handoffs;
CREATE TRIGGER audit_encounter_handoffs_changes
AFTER INSERT OR UPDATE OR DELETE ON public.encounter_handoffs
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_in_basket_tasks_changes ON public.in_basket_tasks;
CREATE TRIGGER audit_in_basket_tasks_changes
AFTER INSERT OR UPDATE OR DELETE ON public.in_basket_tasks
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_adverse_events_changes ON public.adverse_events;
CREATE TRIGGER audit_adverse_events_changes
AFTER INSERT OR UPDATE OR DELETE ON public.adverse_events
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_recent_patients_changes ON public.recent_patients;
CREATE TRIGGER audit_recent_patients_changes
AFTER INSERT OR UPDATE OR DELETE ON public.recent_patients
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_encounter_audit_log_changes ON public.encounter_audit_log;
CREATE TRIGGER audit_encounter_audit_log_changes
AFTER INSERT OR UPDATE OR DELETE ON public.encounter_audit_log
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();
