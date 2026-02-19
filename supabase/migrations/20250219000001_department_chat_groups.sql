-- Manager-configurable department chat groups.

CREATE TABLE IF NOT EXISTS public.employee_chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_chat_groups_unique_active_name
  ON public.employee_chat_groups (LOWER(name))
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_employee_chat_groups_active
  ON public.employee_chat_groups (is_active, name);

CREATE TABLE IF NOT EXISTS public.employee_chat_group_members (
  group_id UUID NOT NULL REFERENCES public.employee_chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_group TEXT NOT NULL DEFAULT 'member'
    CHECK (role_in_group IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_by_name TEXT,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_chat_group_members_user
  ON public.employee_chat_group_members (user_id, group_id);

ALTER TABLE public.employee_chat_messages
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.employee_chat_groups(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_employee_chat_messages_group_created
  ON public.employee_chat_messages (group_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_employee_chat_group_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employee_chat_group_updated_at_trigger ON public.employee_chat_groups;
CREATE TRIGGER set_employee_chat_group_updated_at_trigger
  BEFORE UPDATE ON public.employee_chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_chat_group_updated_at();

DO $$
DECLARE
  v_default_group_id UUID;
BEGIN
  INSERT INTO public.employee_chat_groups (name, department_key, is_active)
  VALUES ('General Staff', NULL, TRUE)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_default_group_id
  FROM public.employee_chat_groups
  WHERE LOWER(name) = LOWER('General Staff')
  ORDER BY created_at
  LIMIT 1;

  UPDATE public.employee_chat_messages
  SET group_id = v_default_group_id
  WHERE group_id IS NULL;

  INSERT INTO public.employee_chat_group_members (group_id, user_id, role_in_group)
  SELECT
    v_default_group_id,
    p.id,
    CASE
      WHEN p.role = 'hospital_manager' THEN 'owner'
      ELSE 'member'
    END
  FROM public.profiles p
  WHERE COALESCE(p.role, '') <> ''
    AND p.role <> 'patient'
  ON CONFLICT (group_id, user_id) DO NOTHING;

  ALTER TABLE public.employee_chat_messages
    ALTER COLUMN group_id SET NOT NULL;
END $$;

ALTER TABLE public.employee_chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_chat_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read employee chat" ON public.employee_chat_messages;
DROP POLICY IF EXISTS "Staff can send employee chat" ON public.employee_chat_messages;
DROP POLICY IF EXISTS "Staff can delete own chat messages" ON public.employee_chat_messages;

CREATE POLICY "Staff can read employee chat in own groups"
  ON public.employee_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (
      SELECT 1
      FROM public.employee_chat_group_members m
      JOIN public.employee_chat_groups g ON g.id = m.group_id
      WHERE m.group_id = employee_chat_messages.group_id
        AND m.user_id = auth.uid()
        AND g.is_active = TRUE
    )
  );

CREATE POLICY "Staff can send employee chat in own groups"
  ON public.employee_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
    AND char_length(message) BETWEEN 1 AND 2000
    AND EXISTS (
      SELECT 1
      FROM public.employee_chat_group_members m
      JOIN public.employee_chat_groups g ON g.id = m.group_id
      WHERE m.group_id = employee_chat_messages.group_id
        AND m.user_id = auth.uid()
        AND g.is_active = TRUE
    )
  );

CREATE POLICY "Staff can delete own chat messages in own groups"
  ON public.employee_chat_messages
  FOR DELETE
  TO authenticated
  USING (
    public.is_staff()
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.employee_chat_group_members m
      WHERE m.group_id = employee_chat_messages.group_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage employee chat groups" ON public.employee_chat_groups;
CREATE POLICY "Managers can manage employee chat groups"
  ON public.employee_chat_groups
  FOR ALL
  TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "Staff can view own employee chat groups" ON public.employee_chat_groups;
CREATE POLICY "Staff can view own employee chat groups"
  ON public.employee_chat_groups
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (
      SELECT 1
      FROM public.employee_chat_group_members m
      WHERE m.group_id = employee_chat_groups.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage employee chat memberships" ON public.employee_chat_group_members;
CREATE POLICY "Managers can manage employee chat memberships"
  ON public.employee_chat_group_members
  FOR ALL
  TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "Users can view own employee chat memberships" ON public.employee_chat_group_members;
CREATE POLICY "Users can view own employee chat memberships"
  ON public.employee_chat_group_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_hospital_manager());
