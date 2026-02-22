-- Pharmacist verification RPCs: avoid direct table access and profiles.full_name fragility.
-- Uses auth.users for display names (same pattern as employee_dm migration).
-- Requires: orders table (20250217000001_initial_schema), is_staff() (20250222000001_employee_dm).
-- Only creates RPCs when orders exists; skip if migration order is wrong (run supabase db reset to fix).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    RETURN;
  END IF;

  EXECUTE $mig$
    CREATE OR REPLACE FUNCTION public.fetch_pending_pharmacy_verification_orders()
    RETURNS TABLE (
      id UUID,
      details JSONB,
      ordered_at TIMESTAMPTZ,
      ordered_by UUID,
      patient_id UUID,
      is_controlled_substance BOOLEAN,
      high_risk_med BOOLEAN,
      ordered_by_name TEXT,
      patient_first_name TEXT,
      patient_last_name TEXT,
      patient_mrn TEXT
    )
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT
        o.id,
        o.details,
        o.ordered_at,
        o.ordered_by,
        o.patient_id,
        o.is_controlled_substance,
        o.high_risk_med,
        COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Unknown') AS ordered_by_name,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.mrn AS patient_mrn
      FROM public.orders o
      LEFT JOIN auth.users u ON u.id = o.ordered_by
      LEFT JOIN public.patients p ON p.id = o.patient_id
      WHERE o.type = 'med'
        AND (o.is_controlled_substance OR o.high_risk_med)
        AND o.status IN ('pending', 'active', 'held')
        AND o.pharmacy_verified_at IS NULL
      ORDER BY o.ordered_at ASC
      LIMIT 50;
    $body$;
  $mig$;

  EXECUTE $mig$
    CREATE OR REPLACE FUNCTION public.verify_pharmacy_order(p_order_id UUID)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_order RECORD;
      v_me UUID := auth.uid();
    BEGIN
      IF v_me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
      END IF;

      IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'Only staff can verify pharmacy orders';
      END IF;

      SELECT id, type, is_controlled_substance, high_risk_med, pharmacy_verified_at
        INTO v_order
      FROM public.orders
      WHERE id = p_order_id;

      IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
      END IF;

      IF v_order.type <> 'med' THEN
        RAISE EXCEPTION 'Only medication orders require pharmacy verification';
      END IF;

      IF NOT (v_order.is_controlled_substance OR v_order.high_risk_med) THEN
        RAISE EXCEPTION 'This order does not require pharmacy verification';
      END IF;

      IF v_order.pharmacy_verified_at IS NOT NULL THEN
        RAISE EXCEPTION 'Order already verified';
      END IF;

      UPDATE public.orders
      SET pharmacy_verified_at = NOW(),
          pharmacy_verified_by = v_me
      WHERE id = p_order_id;
    END;
    $body$;
  $mig$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.fetch_pending_pharmacy_verification_orders() TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.verify_pharmacy_order(UUID) TO authenticated';

  NOTIFY pgrst, 'reload schema';
END $$;
