-- Direct messaging between hospital staff (1-on-1)

-- Ensure profiles.role exists (some setups may have profiles without role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'nurse';
    UPDATE public.profiles SET role = 'nurse' WHERE role IS NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.role, '') <> 'patient'
  );
$$;

CREATE TABLE IF NOT EXISTS public.employee_dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_dm_threads_participants_ordered
    CHECK (participant_1_id < participant_2_id),
  CONSTRAINT employee_dm_threads_unique_pair
    UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_dm_threads_p1
  ON public.employee_dm_threads (participant_1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_dm_threads_p2
  ON public.employee_dm_threads (participant_2_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.employee_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.employee_dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_dm_messages_thread
  ON public.employee_dm_messages (thread_id, created_at DESC);

ALTER TABLE public.employee_dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_dm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own DM threads" ON public.employee_dm_threads;
CREATE POLICY "Staff can view own DM threads"
  ON public.employee_dm_threads FOR SELECT TO authenticated
  USING (
    public.is_staff() AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can insert DM thread when messaging another staff" ON public.employee_dm_threads;
CREATE POLICY "Staff can insert DM thread when messaging another staff"
  ON public.employee_dm_threads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
    AND participant_1_id <> participant_2_id
  );

DROP POLICY IF EXISTS "Staff can read DM messages in own threads" ON public.employee_dm_messages;
CREATE POLICY "Staff can read DM messages in own threads"
  ON public.employee_dm_messages FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (
      SELECT 1 FROM public.employee_dm_threads t
      WHERE t.id = employee_dm_messages.thread_id
        AND (t.participant_1_id = auth.uid() OR t.participant_2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff can send DM messages in own threads" ON public.employee_dm_messages;
CREATE POLICY "Staff can send DM messages in own threads"
  ON public.employee_dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
    AND char_length(message) BETWEEN 1 AND 2000
    AND EXISTS (
      SELECT 1 FROM public.employee_dm_threads t
      WHERE t.id = employee_dm_messages.thread_id
        AND (t.participant_1_id = auth.uid() OR t.participant_2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff can delete own DM messages" ON public.employee_dm_messages;
CREATE POLICY "Staff can delete own DM messages"
  ON public.employee_dm_messages FOR DELETE TO authenticated
  USING (public.is_staff() AND sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_dm_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.employee_dm_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_dm_thread_last_message_trigger ON public.employee_dm_messages;
CREATE TRIGGER update_dm_thread_last_message_trigger
  AFTER INSERT ON public.employee_dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dm_thread_last_message_at();

-- RPC for get-or-create DM thread (bypasses PostgREST schema cache issues with new tables)
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_p1 UUID;
  v_p2 UUID;
  v_thread_id UUID;
BEGIN
  IF v_me IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authenticated or not staff';
  END IF;
  IF p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;
  v_p1 := LEAST(v_me, p_other_user_id);
  v_p2 := GREATEST(v_me, p_other_user_id);
  SELECT id INTO v_thread_id
  FROM public.employee_dm_threads
  WHERE participant_1_id = v_p1 AND participant_2_id = v_p2
  LIMIT 1;
  IF v_thread_id IS NULL THEN
    INSERT INTO public.employee_dm_threads (participant_1_id, participant_2_id)
    VALUES (v_p1, v_p2)
    RETURNING id INTO v_thread_id;
  END IF;
  RETURN v_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_thread(UUID) TO authenticated;

-- RPCs to fetch DM data (avoids schema cache issues with new tables)
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
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Unknown') AS other_user_name,
    t.last_message_at
  FROM public.employee_dm_threads t
  LEFT JOIN auth.users u ON u.id = (CASE WHEN t.participant_1_id = auth.uid() THEN t.participant_2_id ELSE t.participant_1_id END)
  WHERE (t.participant_1_id = auth.uid() OR t.participant_2_id = auth.uid())
  ORDER BY t.last_message_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.fetch_dm_messages(p_thread_id UUID)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_role TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  thread_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.sender_name, m.sender_role, m.message, m.created_at, m.thread_id
  FROM public.employee_dm_messages m
  JOIN public.employee_dm_threads t ON t.id = m.thread_id
  WHERE m.thread_id = p_thread_id
    AND (t.participant_1_id = auth.uid() OR t.participant_2_id = auth.uid())
  ORDER BY m.created_at ASC
  LIMIT 200;
$$;

-- RPC to send a DM message (avoids direct table access / schema cache)
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
  SELECT COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Unknown'),
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

GRANT EXECUTE ON FUNCTION public.fetch_my_dm_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_dm_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_dm_message(UUID, TEXT) TO authenticated;
