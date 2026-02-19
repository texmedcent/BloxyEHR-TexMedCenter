-- Chat safety hardening: owner guardrails + admin audit logging.

CREATE TABLE IF NOT EXISTS public.chat_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.employee_chat_groups(id) ON DELETE SET NULL,
  affected_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'group_created',
      'group_archived',
      'group_reactivated',
      'group_updated',
      'group_deleted',
      'member_added',
      'member_removed',
      'member_role_changed'
    )
  ),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_admin_audit_group_created
  ON public.chat_admin_audit_log (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_admin_audit_created
  ON public.chat_admin_audit_log (created_at DESC);

ALTER TABLE public.chat_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read chat admin audit log" ON public.chat_admin_audit_log;
CREATE POLICY "Managers can read chat admin audit log"
  ON public.chat_admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_hospital_manager());

CREATE OR REPLACE FUNCTION public.get_chat_actor_name()
RETURNS TEXT AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  SELECT COALESCE(p.full_name, p.email, u.email, 'System')
    INTO v_actor_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_actor_name, 'System');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.log_chat_group_admin_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'group_created';
    v_details := jsonb_build_object(
      'name', NEW.name,
      'department_key', NEW.department_key,
      'is_active', NEW.is_active
    );
    INSERT INTO public.chat_admin_audit_log (group_id, action, details, actor_id, actor_name)
    VALUES (NEW.id, v_action, v_details, auth.uid(), public.get_chat_actor_name());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := CASE WHEN NEW.is_active THEN 'group_reactivated' ELSE 'group_archived' END;
    ELSE
      v_action := 'group_updated';
    END IF;

    v_details := jsonb_build_object(
      'old', jsonb_build_object(
        'name', OLD.name,
        'department_key', OLD.department_key,
        'is_active', OLD.is_active
      ),
      'new', jsonb_build_object(
        'name', NEW.name,
        'department_key', NEW.department_key,
        'is_active', NEW.is_active
      )
    );

    INSERT INTO public.chat_admin_audit_log (group_id, action, details, actor_id, actor_name)
    VALUES (NEW.id, v_action, v_details, auth.uid(), public.get_chat_actor_name());
    RETURN NEW;
  END IF;

  v_action := 'group_deleted';
  v_details := jsonb_build_object(
    'name', OLD.name,
    'department_key', OLD.department_key,
    'is_active', OLD.is_active
  );
  INSERT INTO public.chat_admin_audit_log (group_id, action, details, actor_id, actor_name)
  VALUES (OLD.id, v_action, v_details, auth.uid(), public.get_chat_actor_name());
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.enforce_chat_group_owner_guard()
RETURNS TRIGGER AS $$
DECLARE
  remaining_owner_count INTEGER := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role_in_group = 'owner' THEN
      SELECT COUNT(*)
        INTO remaining_owner_count
      FROM public.employee_chat_group_members m
      WHERE m.group_id = OLD.group_id
        AND m.role_in_group = 'owner'
        AND m.user_id <> OLD.user_id;

      IF remaining_owner_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last owner from a chat group.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.role_in_group = 'owner'
    AND (NEW.role_in_group <> 'owner' OR NEW.group_id <> OLD.group_id) THEN
    SELECT COUNT(*)
      INTO remaining_owner_count
    FROM public.employee_chat_group_members m
    WHERE m.group_id = OLD.group_id
      AND m.role_in_group = 'owner'
      AND m.user_id <> OLD.user_id;

    IF remaining_owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote or move the last owner from a chat group.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_chat_membership_admin_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'member_added';
    v_details := jsonb_build_object('role_in_group', NEW.role_in_group);
    INSERT INTO public.chat_admin_audit_log (
      group_id,
      affected_user_id,
      action,
      details,
      actor_id,
      actor_name
    )
    VALUES (
      NEW.group_id,
      NEW.user_id,
      v_action,
      v_details,
      auth.uid(),
      public.get_chat_actor_name()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role_in_group IS DISTINCT FROM NEW.role_in_group THEN
      v_action := 'member_role_changed';
      v_details := jsonb_build_object('old_role', OLD.role_in_group, 'new_role', NEW.role_in_group);
      INSERT INTO public.chat_admin_audit_log (
        group_id,
        affected_user_id,
        action,
        details,
        actor_id,
        actor_name
      )
      VALUES (
        NEW.group_id,
        NEW.user_id,
        v_action,
        v_details,
        auth.uid(),
        public.get_chat_actor_name()
      );
    END IF;
    RETURN NEW;
  END IF;

  v_action := 'member_removed';
  v_details := jsonb_build_object('role_in_group', OLD.role_in_group);
  INSERT INTO public.chat_admin_audit_log (
    group_id,
    affected_user_id,
    action,
    details,
    actor_id,
    actor_name
  )
  VALUES (
    OLD.group_id,
    OLD.user_id,
    v_action,
    v_details,
    auth.uid(),
    public.get_chat_actor_name()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS enforce_chat_group_owner_guard_trigger ON public.employee_chat_group_members;
CREATE TRIGGER enforce_chat_group_owner_guard_trigger
  BEFORE UPDATE OR DELETE ON public.employee_chat_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_chat_group_owner_guard();

DROP TRIGGER IF EXISTS log_chat_group_admin_activity_trigger ON public.employee_chat_groups;
CREATE TRIGGER log_chat_group_admin_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.log_chat_group_admin_activity();

DROP TRIGGER IF EXISTS log_chat_membership_admin_activity_trigger ON public.employee_chat_group_members;
CREATE TRIGGER log_chat_membership_admin_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_chat_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_chat_membership_admin_activity();
