-- Institution campuses with built-in outpatient/inpatient workflow support.

CREATE TABLE IF NOT EXISTS public.institution_campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT institution_campuses_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_institution_campuses_active_sort
  ON public.institution_campuses (is_active, sort_order, name);

INSERT INTO public.institution_campuses (name, sort_order, is_active)
VALUES
  ('Primary Care Office', 10, TRUE),
  ('Emergency Room', 20, TRUE),
  ('Urgent Care', 30, TRUE)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.patient_checkins
  ADD COLUMN IF NOT EXISTS care_setting TEXT;

UPDATE public.patient_checkins
SET care_setting = CASE
  WHEN COALESCE(campus, '') ILIKE '%emergency%' THEN 'inpatient'
  ELSE 'outpatient'
END
WHERE care_setting IS NULL OR care_setting = '';

ALTER TABLE public.patient_checkins
  ALTER COLUMN care_setting SET DEFAULT 'outpatient';

ALTER TABLE public.patient_checkins
  DROP CONSTRAINT IF EXISTS patient_checkins_care_setting_check;

ALTER TABLE public.patient_checkins
  ADD CONSTRAINT patient_checkins_care_setting_check
  CHECK (care_setting IN ('outpatient', 'inpatient'));

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS campus TEXT;

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS care_setting TEXT;

UPDATE public.encounters
SET care_setting = CASE
  WHEN COALESCE(type, '') = 'inpatient' THEN 'inpatient'
  ELSE 'outpatient'
END
WHERE care_setting IS NULL OR care_setting = '';

ALTER TABLE public.encounters
  ALTER COLUMN care_setting SET DEFAULT 'outpatient';

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_care_setting_check;

ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_care_setting_check
  CHECK (care_setting IN ('outpatient', 'inpatient'));

ALTER TABLE public.institution_campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_campuses_select" ON public.institution_campuses;
CREATE POLICY "institution_campuses_select"
  ON public.institution_campuses
  FOR SELECT TO authenticated
  USING (is_active = TRUE OR public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_campuses_write" ON public.institution_campuses;
CREATE POLICY "institution_campuses_write"
  ON public.institution_campuses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_campuses_update" ON public.institution_campuses;
CREATE POLICY "institution_campuses_update"
  ON public.institution_campuses
  FOR UPDATE TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_campuses_delete" ON public.institution_campuses;
CREATE POLICY "institution_campuses_delete"
  ON public.institution_campuses
  FOR DELETE TO authenticated
  USING (public.is_hospital_manager());
