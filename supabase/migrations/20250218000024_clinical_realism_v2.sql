-- Clinical realism v2: results workflow hardening, eMAR scheduling,
-- imaging/specimen lifecycle, AVS packets, and encounter closure controls.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS renal_risk BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hepatic_risk BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pregnancy_status TEXT CHECK (pregnancy_status IN ('not_pregnant', 'pregnant', 'unknown')),
  ADD COLUMN IF NOT EXISTS lactation_status TEXT CHECK (lactation_status IN ('not_lactating', 'lactating', 'unknown'));

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS reviewed_note TEXT,
  ADD COLUMN IF NOT EXISTS action_note TEXT,
  ADD COLUMN IF NOT EXISTS critical_callback_documented BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS critical_callback_documented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS critical_callback_documented_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS critical_callback_documented_by_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_latency_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS action_latency_minutes INTEGER;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS administration_frequency TEXT,
  ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS high_risk_med BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS imaging_status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (imaging_status IN ('ordered', 'performed', 'wet_read', 'final_read')),
  ADD COLUMN IF NOT EXISTS imaging_performed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imaging_wet_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imaging_final_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imaging_wet_read_text TEXT,
  ADD COLUMN IF NOT EXISTS imaging_final_impression TEXT,
  ADD COLUMN IF NOT EXISTS imaging_addendum_text TEXT,
  ADD COLUMN IF NOT EXISTS specimen_status TEXT NOT NULL DEFAULT 'pending_collection'
    CHECK (specimen_status IN ('pending_collection', 'collected', 'received_by_lab', 'rejected', 'recollect_requested', 'completed')),
  ADD COLUMN IF NOT EXISTS specimen_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specimen_collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specimen_collected_by_name TEXT,
  ADD COLUMN IF NOT EXISTS specimen_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specimen_received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specimen_received_by_name TEXT,
  ADD COLUMN IF NOT EXISTS specimen_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS recollect_requested BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.med_admin_log
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS was_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dose_given TEXT,
  ADD COLUMN IF NOT EXISTS route_given TEXT,
  ADD COLUMN IF NOT EXISTS five_rights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS witness_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness_by_name TEXT,
  ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.encounter_avs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounter_avs_encounter
  ON public.encounter_avs(encounter_id, created_at DESC);

ALTER TABLE public.encounter_avs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage encounter_avs" ON public.encounter_avs;
CREATE POLICY "Staff can manage encounter_avs"
  ON public.encounter_avs
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.compute_result_turnaround_latency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acknowledgment_status = 'reviewed'
    AND COALESCE(OLD.acknowledgment_status, '') <> 'reviewed'
    AND NEW.reported_at IS NOT NULL
    AND NEW.acknowledged_at IS NOT NULL THEN
    NEW.reviewed_latency_minutes :=
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.acknowledged_at - NEW.reported_at)) / 60))::INTEGER;
  END IF;

  IF NEW.acknowledgment_status = 'actioned'
    AND COALESCE(OLD.acknowledgment_status, '') <> 'actioned'
    AND NEW.reported_at IS NOT NULL
    AND NEW.actioned_at IS NOT NULL THEN
    NEW.action_latency_minutes :=
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.actioned_at - NEW.reported_at)) / 60))::INTEGER;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.enforce_critical_result_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_critical THEN
    IF NEW.acknowledgment_status = 'reviewed' AND COALESCE(NEW.reviewed_note, '') = '' THEN
      RAISE EXCEPTION 'Critical result requires reviewed note.';
    END IF;
    IF NEW.acknowledgment_status = 'actioned' AND COALESCE(NEW.action_note, '') = '' THEN
      RAISE EXCEPTION 'Critical result requires action taken note.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compute_result_turnaround_latency_trigger ON public.results;
CREATE TRIGGER compute_result_turnaround_latency_trigger
  BEFORE UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_result_turnaround_latency();

DROP TRIGGER IF EXISTS enforce_critical_result_workflow_trigger ON public.results;
CREATE TRIGGER enforce_critical_result_workflow_trigger
  BEFORE UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_critical_result_workflow();

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

DROP TRIGGER IF EXISTS enforce_encounter_closure_requirements_trigger ON public.encounters;
CREATE TRIGGER enforce_encounter_closure_requirements_trigger
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_encounter_closure_requirements();
