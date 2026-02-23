-- Auto-add all staff (non-patient roles) to Atrium Health group chat.
-- Ensures everyone with a staff role is in the Atrium Health Team Chat.

DO $$
DECLARE
  v_atrium_group_id UUID;
BEGIN
  -- Create Atrium Health group if it doesn't exist
  INSERT INTO public.employee_chat_groups (name, department_key, is_active)
  SELECT 'Atrium Health', NULL, TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_chat_groups
    WHERE LOWER(name) = 'atrium health' AND is_active = TRUE
  );

  -- Get the Atrium Health group id (unique index is on LOWER(name) for active groups)
  SELECT id INTO v_atrium_group_id
  FROM public.employee_chat_groups
  WHERE LOWER(name) = 'atrium health'
    AND is_active = TRUE
  ORDER BY created_at
  LIMIT 1;

  IF v_atrium_group_id IS NULL THEN
    RETURN;
  END IF;

  -- Backfill: add all current non-patient staff to Atrium Health
  INSERT INTO public.employee_chat_group_members (group_id, user_id, role_in_group)
  SELECT
    v_atrium_group_id,
    p.id,
    CASE WHEN p.role = 'hospital_manager' THEN 'owner' ELSE 'member' END
  FROM public.profiles p
  WHERE p.id IS NOT NULL
    AND COALESCE(p.role, '') <> ''
    AND p.role <> 'patient'
  ON CONFLICT (group_id, user_id) DO NOTHING;
END $$;

-- Trigger: when a profile gets a non-patient role, add them to Atrium Health
CREATE OR REPLACE FUNCTION public.auto_join_atrium_health_on_staff_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atrium_group_id UUID;
  v_new_is_staff BOOLEAN;
  v_old_is_staff BOOLEAN;
BEGIN
  v_new_is_staff := (COALESCE(NEW.role, '') <> '' AND NEW.role <> 'patient');
  v_old_is_staff := (COALESCE(OLD.role, '') <> '' AND OLD.role <> 'patient');

  -- Only act when role changes to staff (INSERT with staff role, or UPDATE from patient/none to staff)
  IF NOT v_new_is_staff THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND v_old_is_staff THEN
    RETURN NEW;  -- Already staff, no need to add again
  END IF;

  SELECT id INTO v_atrium_group_id
  FROM public.employee_chat_groups
  WHERE LOWER(name) = 'atrium health'
    AND is_active = TRUE
  ORDER BY created_at
  LIMIT 1;

  IF v_atrium_group_id IS NOT NULL THEN
    INSERT INTO public.employee_chat_group_members (group_id, user_id, role_in_group)
    VALUES (
      v_atrium_group_id,
      NEW.id,
      CASE WHEN NEW.role = 'hospital_manager' THEN 'owner' ELSE 'member' END
    )
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_join_atrium_health_trigger ON public.profiles;
CREATE TRIGGER auto_join_atrium_health_trigger
  AFTER INSERT OR UPDATE OF role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_join_atrium_health_on_staff_role();
