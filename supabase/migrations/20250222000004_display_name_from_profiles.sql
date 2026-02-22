-- Use profiles.full_name (Settings display name) everywhere instead of raw_user_meta_data or email prefix.
-- Ensures chat, DMs, and pharmacy views show the name users select in Settings.

-- DM threads: show other participant's display name from profiles
CREATE OR REPLACE FUNCTION public.fetch_my_dm_threads()
RETURNS TABLE (
  id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    CASE WHEN t.participant_1_id = auth.uid() THEN t.participant_2_id ELSE t.participant_1_id END AS other_user_id,
    COALESCE(
      p.full_name,
      split_part(u.email, '@', 1),
      'Unknown'
    ) AS other_user_name,
    t.last_message_at
  FROM public.employee_dm_threads t
  LEFT JOIN auth.users u ON u.id = (CASE WHEN t.participant_1_id = auth.uid() THEN t.participant_2_id ELSE t.participant_1_id END)
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (t.participant_1_id = auth.uid() OR t.participant_2_id = auth.uid())
  ORDER BY t.last_message_at DESC
  LIMIT 50;
$$;

-- DM send: use current user's profiles.full_name for sender_name
CREATE OR REPLACE FUNCTION public.send_dm_message(p_thread_id UUID, p_message TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_name TEXT;
  v_role TEXT;
  v_msg_id UUID;
BEGIN
  IF v_me IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authenticated or not staff';
  END IF;
  IF p_message IS NULL OR char_length(trim(p_message)) < 1 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_dm_threads t
    WHERE t.id = p_thread_id AND (t.participant_1_id = v_me OR t.participant_2_id = v_me)
  ) THEN
    RAISE EXCEPTION 'Thread not found or access denied';
  END IF;
  SELECT COALESCE(p.full_name, split_part(u.email, '@', 1), 'Unknown'),
         COALESCE(p.role, '')
    INTO v_name, v_role
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_me;
  INSERT INTO public.employee_dm_messages (thread_id, sender_id, sender_name, sender_role, message)
  VALUES (p_thread_id, v_me, v_name, v_role, trim(p_message))
  RETURNING id INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

-- Pharmacist panel: ordered_by_name from profiles.full_name
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
        COALESCE(pr.full_name, split_part(u.email, '@', 1), 'Unknown') AS ordered_by_name,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.mrn AS patient_mrn
      FROM public.orders o
      LEFT JOIN auth.users u ON u.id = o.ordered_by
      LEFT JOIN public.profiles pr ON pr.id = o.ordered_by
      LEFT JOIN public.patients p ON p.id = o.patient_id
      WHERE o.type = 'med'
        AND (o.is_controlled_substance OR o.high_risk_med)
        AND o.status IN ('pending', 'active', 'held')
        AND o.pharmacy_verified_at IS NULL
      ORDER BY o.ordered_at ASC
      LIMIT 50;
    $body$;
  $mig$;
END $$;
