-- Pharmacist Panel and medication order bypass for controlled substances / high-risk meds.
-- Only controlled substances and high-risk meds require pharmacist verification.

ALTER TABLE public.institution_settings
  ADD COLUMN IF NOT EXISTS bypass_pharmacy_verification BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pharmacy_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pharmacy_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_med_admin_schedule_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
  v_bypass BOOLEAN;
BEGIN
  SELECT id, type, status, next_due_at, is_controlled_substance, high_risk_med, pharmacy_verified_at
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

  -- Pharmacy verification: only for controlled substances and high-risk meds when bypass is off
  IF (v_order.is_controlled_substance OR v_order.high_risk_med) THEN
    SELECT bypass_pharmacy_verification
      INTO v_bypass
    FROM public.institution_settings
    WHERE id = 1;

    IF COALESCE(v_bypass, false) = false THEN
      IF v_order.pharmacy_verified_at IS NULL THEN
        RAISE EXCEPTION 'This medication requires pharmacist verification before administration. Please have a pharmacist verify the order in the Pharmacist Panel.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
