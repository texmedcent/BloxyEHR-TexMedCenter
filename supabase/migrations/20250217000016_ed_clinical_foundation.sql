-- ED clinical foundation: triage, result acknowledgment, disposition,
-- flowsheets, handoff, in-basket tasks, attestations, timers, and adverse events.

ALTER TABLE public.patient_checkins
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS acuity_level TEXT
    CHECK (acuity_level IN ('esi_1', 'esi_2', 'esi_3', 'esi_4', 'esi_5')),
  ADD COLUMN IF NOT EXISTS pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS arrival_mode TEXT
    CHECK (arrival_mode IN ('walk_in', 'ambulance', 'transfer', 'police', 'other')),
  ADD COLUMN IF NOT EXISTS reassess_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reassessed_at TIMESTAMPTZ;

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS disposition_type TEXT
    CHECK (disposition_type IN ('admit', 'discharge', 'transfer', 'eloped', 'ama', 'expired')),
  ADD COLUMN IF NOT EXISTS discharge_instructions TEXT,
  ADD COLUMN IF NOT EXISTS return_precautions TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_destination TEXT,
  ADD COLUMN IF NOT EXISTS disposition_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disposition_set_by_name TEXT,
  ADD COLUMN IF NOT EXISTS disposition_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_provider_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_med_ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_med_admin_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS protocol_set TEXT,
  ADD COLUMN IF NOT EXISTS hold_reason TEXT;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS acknowledgment_status TEXT NOT NULL DEFAULT 'new'
    CHECK (acknowledgment_status IN ('new', 'reviewed', 'actioned')),
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_by_name TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actioned_by_name TEXT,
  ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS critical_reason TEXT;

ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS requires_cosign BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cosign_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (cosign_status IN ('not_required', 'pending', 'co_signed')),
  ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cosigned_by_name TEXT,
  ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.nursing_flowsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  intake_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  reassess_due_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursing_flowsheets_encounter
  ON public.nursing_flowsheets(encounter_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.encounter_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_user_name TEXT,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_name TEXT,
  sbar JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'completed')),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounter_handoffs_encounter
  ON public.encounter_handoffs(encounter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.in_basket_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT,
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  completion_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_basket_tasks_owner
  ON public.in_basket_tasks(owner_id, status, due_at);

CREATE TABLE IF NOT EXISTS public.adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'sentinel')),
  description TEXT NOT NULL,
  immediate_actions TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'closed')),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adverse_events_status
  ON public.adverse_events(status, severity, created_at DESC);

ALTER TABLE public.nursing_flowsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_basket_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adverse_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage nursing_flowsheets" ON public.nursing_flowsheets;
CREATE POLICY "Staff can manage nursing_flowsheets"
  ON public.nursing_flowsheets
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can manage encounter_handoffs" ON public.encounter_handoffs;
CREATE POLICY "Staff can manage encounter_handoffs"
  ON public.encounter_handoffs
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Users can manage own in_basket_tasks" ON public.in_basket_tasks;
CREATE POLICY "Users can manage own in_basket_tasks"
  ON public.in_basket_tasks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_hospital_manager())
  WITH CHECK (owner_id = auth.uid() OR public.is_hospital_manager());

DROP POLICY IF EXISTS "Staff can manage adverse_events" ON public.adverse_events;
CREATE POLICY "Staff can manage adverse_events"
  ON public.adverse_events
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.handle_result_inbasket_notifications()
RETURNS TRIGGER AS $$
DECLARE
  ordering_provider UUID;
  encounter_assignee UUID;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT ordered_by INTO ordering_provider
    FROM public.orders
    WHERE id = NEW.order_id;
  END IF;

  IF ordering_provider IS NOT NULL THEN
    INSERT INTO public.in_basket_items (recipient_id, type, related_entity_id, priority)
    VALUES (
      ordering_provider,
      'result',
      NEW.id,
      CASE WHEN NEW.is_critical THEN 'high' ELSE 'normal' END
    );
  END IF;

  IF NEW.is_critical IS TRUE AND NEW.order_id IS NOT NULL THEN
    SELECT e.assigned_to INTO encounter_assignee
    FROM public.orders o
    JOIN public.encounters e ON e.id = o.encounter_id
    WHERE o.id = NEW.order_id
    LIMIT 1;

    IF encounter_assignee IS NOT NULL THEN
      INSERT INTO public.in_basket_items (recipient_id, type, related_entity_id, priority)
      VALUES (encounter_assignee, 'task', NEW.id, 'high');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_result_created ON public.results;
CREATE TRIGGER on_result_created
  AFTER INSERT ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_result_inbasket_notifications();

CREATE OR REPLACE FUNCTION public.track_first_provider_seen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
    AND NEW.first_provider_seen_at IS NULL THEN
    NEW.first_provider_seen_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_first_provider_seen_trigger ON public.encounters;
CREATE TRIGGER track_first_provider_seen_trigger
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.track_first_provider_seen();

CREATE OR REPLACE FUNCTION public.track_first_med_ordered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'med' AND NEW.encounter_id IS NOT NULL THEN
    UPDATE public.encounters
    SET first_med_ordered_at = COALESCE(first_med_ordered_at, NEW.ordered_at)
    WHERE id = NEW.encounter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_first_med_ordered_trigger ON public.orders;
CREATE TRIGGER track_first_med_ordered_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_first_med_ordered();

CREATE OR REPLACE FUNCTION public.track_first_med_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_encounter_id UUID;
BEGIN
  SELECT encounter_id INTO v_encounter_id
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_encounter_id IS NOT NULL THEN
    UPDATE public.encounters
    SET first_med_admin_at = COALESCE(first_med_admin_at, NEW.event_at)
    WHERE id = v_encounter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_first_med_admin_trigger ON public.med_admin_log;
CREATE TRIGGER track_first_med_admin_trigger
  AFTER INSERT ON public.med_admin_log
  FOR EACH ROW
  EXECUTE FUNCTION public.track_first_med_admin();
