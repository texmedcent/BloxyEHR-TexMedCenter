-- Allow staff/providers to self-assign up to 3 departments.
-- profiles.department_id remains the primary department for existing app flows.

CREATE TABLE IF NOT EXISTS public.profile_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.institution_departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_departments_user
  ON public.profile_departments(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_departments_dept
  ON public.profile_departments(department_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_departments_one_primary
  ON public.profile_departments(user_id)
  WHERE is_primary = TRUE;

CREATE OR REPLACE FUNCTION public.enforce_profile_departments_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.profile_departments pd
  WHERE pd.user_id = NEW.user_id
    AND pd.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF current_count >= 3 THEN
    RAISE EXCEPTION 'A user can have at most 3 departments';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_profile_departments_limit_trigger ON public.profile_departments;
CREATE TRIGGER enforce_profile_departments_limit_trigger
  BEFORE INSERT ON public.profile_departments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_departments_limit();

ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile departments" ON public.profile_departments;
CREATE POLICY "Users can read own profile departments"
  ON public.profile_departments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hospital_manager());

DROP POLICY IF EXISTS "Users can manage own profile departments" ON public.profile_departments;
CREATE POLICY "Users can manage own profile departments"
  ON public.profile_departments
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_hospital_manager())
  WITH CHECK (user_id = auth.uid() OR public.is_hospital_manager());
