-- Clinical gap closure (P0-P2): order lifecycle integrity, med schedule integrity,
-- critical result SLA escalation, signed-note immutability/addenda,
-- task SLA escalation, encounter closure hardening, and patient release controls.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discontinued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discontinued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_allowed_values'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_allowed_values
      CHECK (status IN ('pending', 'active', 'completed', 'discontinued', 'cancelled', 'held'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_order_status_transitions()
RETURNS TRIGGER AS $$
DECLARE
  discontinuation_reason TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('completed', 'discontinued', 'cancelled')
      AND NEW.status NOT IN ('completed', 'discontinued', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot reactivate terminal order (old status: %).', OLD.status;
    END IF;

    IF NEW.status = 'discontinued' THEN
      discontinuation_reason := COALESCE(NEW.details->>'discontinuation_reason', '');
      IF length(trim(discontinuation_reason)) = 0 THEN
        RAISE EXCEPTION 'Discontinuation requires discontinuation_reason in order details.';
      END IF;
    END IF;

    IF NEW.status = 'completed' AND OLD.status = 'discontinued' THEN
      RAISE EXCEPTION 'Cannot complete a discontinued order.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.track_order_terminal_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    NEW.completed_by := COALESCE(NEW.completed_by, auth.uid());
  END IF;
  IF NEW.status = 'discontinued' AND COALESCE(OLD.status, '') <> 'discontinued' THEN
    NEW.discontinued_at := COALESCE(NEW.discontinued_at, NOW());
    NEW.discontinued_by := COALESCE(NEW.discontinued_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_order_status_transitions_trigger ON public.orders;
CREATE TRIGGER enforce_order_status_transitions_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_transitions();

DROP TRIGGER IF EXISTS track_order_terminal_timestamps_trigger ON public.orders;
CREATE TRIGGER track_order_terminal_timestamps_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_order_terminal_timestamps();

CREATE OR REPLACE FUNCTION public.parse_med_frequency_interval(freq TEXT)
RETURNS INTERVAL AS $$
DECLARE
  normalized TEXT := upper(trim(COALESCE(freq, '')));
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  ELSIF normalized LIKE 'Q4%' THEN
    RETURN INTERVAL '4 hours';
  ELSIF normalized LIKE 'Q6%' THEN
    RETURN INTERVAL '6 hours';
  ELSIF normalized LIKE 'Q8%' THEN
    RETURN INTERVAL '8 hours';
  ELSIF normalized LIKE 'Q12%' OR normalized = 'BID' THEN
    RETURN INTERVAL '12 hours';
  ELSIF normalized = 'TID' THEN
    RETURN INTERVAL '8 hours';
  ELSIF normalized = 'QID' THEN
    RETURN INTERVAL '6 hours';
  ELSIF normalized = 'DAILY' OR normalized = 'QD' OR normalized = 'ONCE DAILY' THEN
    RETURN INTERVAL '24 hours';
  ELSIF normalized = 'ONCE' THEN
    RETURN NULL;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.validate_med_admin_schedule_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, type, status, next_due_at
    INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found for administration log.';
  END IF;

  IF v_order.type <> 'med' THEN
    RAISE EXCEPTION 'eMAR logs can only be attached to medication orders.';
  END IF;

  IF v_order.status IN ('completed', 'discontinued', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot document administration for % medication orders.', v_order.status;
  END IF;

  IF NEW.event_type = 'administered' AND NEW.scheduled_for IS NULL THEN
    RAISE EXCEPTION 'Scheduled due time is required for administered events.';
  END IF;

  IF NEW.event_type = 'administered'
    AND NEW.scheduled_for IS NOT NULL
    AND v_order.next_due_at IS NOT NULL
    AND ABS(EXTRACT(EPOCH FROM (NEW.scheduled_for - v_order.next_due_at))) > 7200 THEN
    RAISE EXCEPTION 'Scheduled administration time must be within 2 hours of order next due time.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.advance_order_next_due_after_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_frequency TEXT;
  v_interval INTERVAL;
BEGIN
  IF NEW.event_type <> 'administered' THEN
    RETURN NEW;
  END IF;

  SELECT administration_frequency INTO v_frequency
  FROM public.orders
  WHERE id = NEW.order_id;

  v_interval := public.parse_med_frequency_interval(v_frequency);

  UPDATE public.orders
  SET
    next_due_at = CASE
      WHEN v_interval IS NULL THEN NULL
      ELSE NEW.event_at + v_interval
    END,
    status = CASE
      WHEN v_interval IS NULL THEN 'completed'
      ELSE status
    END
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_med_admin_schedule_integrity_trigger ON public.med_admin_log;
CREATE TRIGGER validate_med_admin_schedule_integrity_trigger
  BEFORE INSERT ON public.med_admin_log
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_med_admin_schedule_integrity();

DROP TRIGGER IF EXISTS advance_order_next_due_after_admin_trigger ON public.med_admin_log;
CREATE TRIGGER advance_order_next_due_after_admin_trigger
  AFTER INSERT ON public.med_admin_log
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_order_next_due_after_admin();

DO $$
BEGIN
  -- Backfill legacy eMAR rows created before scheduled_for became required.
  UPDATE public.med_admin_log
  SET scheduled_for = event_at
  WHERE event_type = 'administered'
    AND scheduled_for IS NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'med_admin_scheduled_required_for_administered'
      AND conrelid = 'public.med_admin_log'::regclass
  ) THEN
    ALTER TABLE public.med_admin_log
      ADD CONSTRAINT med_admin_scheduled_required_for_administered
      CHECK (
        (event_type = 'administered' AND scheduled_for IS NOT NULL)
        OR event_type = 'not_given'
      );
  END IF;
END $$;

ALTER TABLE public.institution_settings
  ADD COLUMN IF NOT EXISTS critical_result_review_sla_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS critical_result_action_sla_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS escalation_triggered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS sla_violation_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_violation_actioned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_to_patient_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_to_patient_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_to_patient_by_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_release_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS patient_release_hold_reason TEXT;

ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS is_addendum BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_note_id UUID REFERENCES public.clinical_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS addendum_reason TEXT,
  ADD COLUMN IF NOT EXISTS released_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_to_patient_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_to_patient_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_to_patient_by_name TEXT,
  ADD COLUMN IF NOT EXISTS patient_release_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS patient_release_hold_reason TEXT;

ALTER TABLE public.in_basket_tasks
  ADD COLUMN IF NOT EXISTS related_result_id UUID REFERENCES public.results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_violation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_triggered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_to_name TEXT;

CREATE INDEX IF NOT EXISTS idx_in_basket_tasks_related_result
  ON public.in_basket_tasks(related_result_id, owner_id, status);

CREATE TABLE IF NOT EXISTS public.patient_release_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('result', 'note')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('release', 'hold', 'unhold', 'revoke')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_release_audit_patient
  ON public.patient_release_audit(patient_id, created_at DESC);

ALTER TABLE public.patient_release_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage patient_release_audit" ON public.patient_release_audit;
CREATE POLICY "Staff can manage patient_release_audit"
  ON public.patient_release_audit
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.enforce_signed_note_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL OR COALESCE(OLD.cosign_status, '') = 'co_signed' THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'Signed/co-signed notes are immutable. Create an addendum.';
    END IF;
  END IF;

  IF OLD.signed_at IS NOT NULL AND NEW.signed_at IS NULL THEN
    RAISE EXCEPTION 'Cannot remove signature from signed note.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_signed_note_immutability_trigger ON public.clinical_notes;
CREATE TRIGGER enforce_signed_note_immutability_trigger
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signed_note_immutability();

CREATE OR REPLACE FUNCTION public.apply_result_sla_and_release_logic()
RETURNS TRIGGER AS $$
DECLARE
  review_sla INTEGER := 30;
  action_sla INTEGER := 60;
  elapsed_minutes INTEGER := 0;
  actor_name TEXT;
BEGIN
  IF NEW.reported_at IS NOT NULL THEN
    elapsed_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - NEW.reported_at)) / 60))::INTEGER;
  END IF;

  SELECT critical_result_review_sla_minutes, critical_result_action_sla_minutes
    INTO review_sla, action_sla
  FROM public.institution_settings
  WHERE id = 1;

  review_sla := COALESCE(review_sla, 30);
  action_sla := COALESCE(action_sla, 60);

  IF NEW.is_critical THEN
    IF COALESCE(NEW.acknowledgment_status, 'new') = 'new' AND elapsed_minutes > review_sla THEN
      NEW.sla_violation_reviewed := TRUE;
    END IF;
    IF COALESCE(NEW.acknowledgment_status, 'new') <> 'actioned' AND elapsed_minutes > action_sla THEN
      NEW.sla_violation_actioned := TRUE;
    END IF;
  END IF;

  IF NEW.patient_release_hold THEN
    NEW.released_to_patient := FALSE;
    NEW.released_to_patient_at := NULL;
    NEW.released_to_patient_by := NULL;
    NEW.released_to_patient_by_name := NULL;
  ELSIF NEW.status = 'final' AND NOT NEW.is_critical AND NEW.released_to_patient = FALSE THEN
    NEW.released_to_patient := TRUE;
    NEW.released_to_patient_at := NOW();
    NEW.released_to_patient_by := auth.uid();
    SELECT COALESCE(p.full_name, u.email, 'Clinician')
      INTO actor_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = auth.uid();
    NEW.released_to_patient_by_name := actor_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS apply_result_sla_and_release_logic_trigger ON public.results;
CREATE TRIGGER apply_result_sla_and_release_logic_trigger
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_result_sla_and_release_logic();

CREATE OR REPLACE FUNCTION public.apply_note_release_logic()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  IF NEW.patient_release_hold THEN
    NEW.released_to_patient := FALSE;
    NEW.released_to_patient_at := NULL;
    NEW.released_to_patient_by := NULL;
    NEW.released_to_patient_by_name := NULL;
  ELSIF NEW.signed_at IS NOT NULL AND NEW.released_to_patient = FALSE AND NOT NEW.patient_release_hold THEN
    NEW.released_to_patient := TRUE;
    NEW.released_to_patient_at := NOW();
    NEW.released_to_patient_by := auth.uid();
    SELECT COALESCE(p.full_name, u.email, 'Clinician')
      INTO actor_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = auth.uid();
    NEW.released_to_patient_by_name := actor_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS apply_note_release_logic_trigger ON public.clinical_notes;
CREATE TRIGGER apply_note_release_logic_trigger
  BEFORE INSERT OR UPDATE ON public.clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_note_release_logic();

CREATE OR REPLACE FUNCTION public.create_critical_result_escalation_tasks()
RETURNS TRIGGER AS $$
DECLARE
  v_ordered_by UUID;
  v_assigned_to UUID;
  v_assigned_name TEXT;
  v_owner UUID;
  v_owner_name TEXT;
  v_detail TEXT;
BEGIN
  IF NOT NEW.is_critical OR NEW.escalation_triggered_at IS NOT NULL OR COALESCE(NEW.acknowledgment_status, 'new') <> 'new' THEN
    RETURN NEW;
  END IF;

  IF NEW.reported_at IS NULL OR NEW.sla_violation_reviewed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT o.ordered_by, e.assigned_to, e.assigned_to_name
      INTO v_ordered_by, v_assigned_to, v_assigned_name
    FROM public.orders o
    LEFT JOIN public.encounters e ON e.id = o.encounter_id
    WHERE o.id = NEW.order_id
    LIMIT 1;
  END IF;

  v_detail := format(
    'Critical %s result has exceeded review SLA. Reported at %s.',
    COALESCE(NEW.type, 'result'),
    COALESCE(to_char(NEW.reported_at, 'YYYY-MM-DD HH24:MI:SS TZ'), 'unknown time')
  );

  FOR v_owner IN SELECT DISTINCT unnest(ARRAY[v_ordered_by, v_assigned_to])
  LOOP
    IF v_owner IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(p.full_name, u.email, 'Clinician')
      INTO v_owner_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_owner
    LIMIT 1;

    IF v_owner IS NOT NULL THEN
      INSERT INTO public.in_basket_tasks (
        patient_id,
        encounter_id,
        owner_id,
        owner_name,
        title,
        details,
        due_at,
        priority,
        status,
        created_by,
        created_by_name,
        related_result_id
      )
      SELECT
        NEW.patient_id,
        o.encounter_id,
        v_owner,
        COALESCE(v_owner_name, v_assigned_name, 'Clinician'),
        'Critical result overdue review',
        v_detail,
        NOW(),
        'critical',
        'open',
        auth.uid(),
        COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'System'),
        NEW.id
      FROM public.orders o
      WHERE o.id = NEW.order_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.in_basket_tasks t
          WHERE t.owner_id = v_owner
            AND t.related_result_id = NEW.id
            AND t.status IN ('open', 'in_progress')
        );
    END IF;
  END LOOP;

  NEW.escalation_triggered_at := NOW();
  NEW.escalation_recipient_id := COALESCE(v_assigned_to, v_ordered_by);
  NEW.escalation_recipient_name := COALESCE(v_assigned_name, v_owner_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_critical_result_escalation_tasks_trigger ON public.results;
CREATE TRIGGER create_critical_result_escalation_tasks_trigger
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.create_critical_result_escalation_tasks();

CREATE OR REPLACE FUNCTION public.apply_task_sla_flags()
RETURNS TRIGGER AS $$
DECLARE
  overdue_minutes INTEGER := 0;
BEGIN
  IF NEW.status IN ('open', 'in_progress') AND NEW.due_at IS NOT NULL THEN
    overdue_minutes := FLOOR(EXTRACT(EPOCH FROM (NOW() - NEW.due_at)) / 60)::INTEGER;
    IF overdue_minutes > 0 THEN
      NEW.sla_violation := TRUE;
    END IF;

    IF overdue_minutes > 120
      AND NEW.priority IN ('high', 'critical')
      AND NEW.escalation_triggered_at IS NULL THEN
      NEW.escalation_triggered_at := NOW();
      SELECT p.id, p.full_name
        INTO NEW.escalated_to, NEW.escalated_to_name
      FROM public.profiles p
      WHERE p.role IN ('hospital_manager', 'chief_medical_officer', 'attending_physician')
      ORDER BY p.created_at ASC
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS apply_task_sla_flags_trigger ON public.in_basket_tasks;
CREATE TRIGGER apply_task_sla_flags_trigger
  BEFORE INSERT OR UPDATE ON public.in_basket_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_task_sla_flags();

CREATE OR REPLACE FUNCTION public.notify_task_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.escalation_triggered_at IS NOT NULL
    AND OLD.escalation_triggered_at IS NULL
    AND NEW.escalated_to IS NOT NULL THEN
    INSERT INTO public.in_basket_items (recipient_id, type, related_entity_id, priority)
    VALUES (NEW.escalated_to, 'task', NEW.id, 'high');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_task_escalation_trigger ON public.in_basket_tasks;
CREATE TRIGGER notify_task_escalation_trigger
  AFTER UPDATE ON public.in_basket_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_escalation();

CREATE OR REPLACE FUNCTION public.log_patient_release_events()
RETURNS TRIGGER AS $$
DECLARE
  entity_name TEXT;
BEGIN
  entity_name := CASE WHEN TG_TABLE_NAME = 'results' THEN 'result' ELSE 'note' END;

  IF NEW.patient_release_hold IS TRUE AND COALESCE(OLD.patient_release_hold, FALSE) = FALSE THEN
    INSERT INTO public.patient_release_audit (patient_id, entity_type, entity_id, action, actor_id, actor_name, reason)
    VALUES (
      NEW.patient_id,
      entity_name,
      NEW.id,
      'hold',
      auth.uid(),
      COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Clinician'),
      NEW.patient_release_hold_reason
    );
  ELSIF NEW.patient_release_hold IS FALSE AND COALESCE(OLD.patient_release_hold, FALSE) = TRUE THEN
    INSERT INTO public.patient_release_audit (patient_id, entity_type, entity_id, action, actor_id, actor_name, reason)
    VALUES (
      NEW.patient_id,
      entity_name,
      NEW.id,
      'unhold',
      auth.uid(),
      COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Clinician'),
      NULL
    );
  END IF;

  IF NEW.released_to_patient IS TRUE AND COALESCE(OLD.released_to_patient, FALSE) = FALSE THEN
    INSERT INTO public.patient_release_audit (patient_id, entity_type, entity_id, action, actor_id, actor_name, reason)
    VALUES (
      NEW.patient_id,
      entity_name,
      NEW.id,
      'release',
      auth.uid(),
      COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Clinician'),
      NULL
    );
  ELSIF NEW.released_to_patient IS FALSE AND COALESCE(OLD.released_to_patient, FALSE) = TRUE THEN
    INSERT INTO public.patient_release_audit (patient_id, entity_type, entity_id, action, actor_id, actor_name, reason)
    VALUES (
      NEW.patient_id,
      entity_name,
      NEW.id,
      'revoke',
      auth.uid(),
      COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Clinician'),
      NEW.patient_release_hold_reason
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS log_patient_release_events_results_trigger ON public.results;
CREATE TRIGGER log_patient_release_events_results_trigger
  AFTER UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.log_patient_release_events();

DROP TRIGGER IF EXISTS log_patient_release_events_notes_trigger ON public.clinical_notes;
CREATE TRIGGER log_patient_release_events_notes_trigger
  AFTER UPDATE ON public.clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_patient_release_events();

CREATE OR REPLACE FUNCTION public.enforce_encounter_closure_requirements()
RETURNS TRIGGER AS $$
DECLARE
  unresolved_med_recs INTEGER := 0;
  unactioned_critical_results INTEGER := 0;
  unresolved_tasks INTEGER := 0;
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

    SELECT COUNT(*)
      INTO unactioned_critical_results
    FROM public.results r
    JOIN public.orders o ON o.id = r.order_id
    WHERE o.encounter_id = NEW.id
      AND r.is_critical = TRUE
      AND COALESCE(r.acknowledgment_status, 'new') <> 'actioned';

    IF unactioned_critical_results > 0 THEN
      RAISE EXCEPTION 'Cannot finalize encounter with unactioned critical results (% results).', unactioned_critical_results;
    END IF;

    SELECT COUNT(*)
      INTO unresolved_tasks
    FROM public.in_basket_tasks t
    WHERE t.encounter_id = NEW.id
      AND t.status IN ('open', 'in_progress');

    IF unresolved_tasks > 0 THEN
      RAISE EXCEPTION 'Cannot finalize encounter with open encounter tasks (% tasks).', unresolved_tasks;
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
