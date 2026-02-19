-- Reconcile full audit trigger coverage so all core + ED writes land in patient_audit_log.

CREATE TABLE IF NOT EXISTS public.patient_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_audit_log_patient_id ON public.patient_audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_audit_log_performed_at ON public.patient_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_audit_log_table_name ON public.patient_audit_log(table_name);

ALTER TABLE public.patient_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hospital managers can read patient_audit_log" ON public.patient_audit_log;
CREATE POLICY "Hospital managers can read patient_audit_log" ON public.patient_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'hospital_manager'
    )
  );

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_patients_changes ON public.patients;
CREATE TRIGGER audit_patients_changes
AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_encounters_changes ON public.encounters;
CREATE TRIGGER audit_encounters_changes
AFTER INSERT OR UPDATE OR DELETE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_clinical_notes_changes ON public.clinical_notes;
CREATE TRIGGER audit_clinical_notes_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_orders_changes ON public.orders;
CREATE TRIGGER audit_orders_changes
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_results_changes ON public.results;
CREATE TRIGGER audit_results_changes
AFTER INSERT OR UPDATE OR DELETE ON public.results
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_vital_signs_changes ON public.vital_signs;
CREATE TRIGGER audit_vital_signs_changes
AFTER INSERT OR UPDATE OR DELETE ON public.vital_signs
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_patient_problems_changes ON public.patient_problems;
CREATE TRIGGER audit_patient_problems_changes
AFTER INSERT OR UPDATE OR DELETE ON public.patient_problems
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_patient_checkins_changes ON public.patient_checkins;
CREATE TRIGGER audit_patient_checkins_changes
AFTER INSERT OR UPDATE OR DELETE ON public.patient_checkins
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_appointments_changes ON public.appointments;
CREATE TRIGGER audit_appointments_changes
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

DROP TRIGGER IF EXISTS audit_med_admin_log_changes ON public.med_admin_log;
CREATE TRIGGER audit_med_admin_log_changes
AFTER INSERT OR UPDATE OR DELETE ON public.med_admin_log
FOR EACH ROW EXECUTE FUNCTION public.log_patient_table_activity();

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
