-- Canonical departments (Hospital Managers CRUD); profiles.department_id links here.
-- profiles.department (TEXT) kept in sync for legacy queries (staff_shifts, department_tasks, etc.).

CREATE TABLE IF NOT EXISTS public.institution_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT institution_departments_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_institution_departments_active_sort
  ON public.institution_departments (is_active, sort_order, name);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.institution_departments(id) ON DELETE SET NULL;

-- Legacy free-text field (staff_shifts, department_tasks, etc.); ensure column exists before backfill.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles(department_id);

-- Teaching hospital / Level 1 trauma–style catalog: Big Five, surgical, diagnostic, focused care, plus core units.
INSERT INTO public.institution_departments (name, sort_order, is_active)
VALUES
  -- 1. The Big Five — Emergency Medicine (EM) + subs
  ('Emergency Medicine (EM)', 100, TRUE),
  ('Pediatric Emergency Medicine', 105, TRUE),
  ('Medical Toxicology', 110, TRUE),
  ('Sports Medicine (Emergency Medicine)', 115, TRUE),
  ('Undersea & Hyperbaric Medicine', 120, TRUE),
  ('Level 1 Trauma / Trauma Center', 125, TRUE),

  -- Internal Medicine (IM) — largest department + organ-system subs
  ('Internal Medicine (IM)', 200, TRUE),
  ('Cardiology', 205, TRUE),
  ('Gastroenterology (GI)', 210, TRUE),
  ('Nephrology', 215, TRUE),
  ('Pulmonology', 220, TRUE),
  ('Endocrinology', 225, TRUE),
  ('Rheumatology', 230, TRUE),
  ('Infectious Disease (ID)', 235, TRUE),
  ('Hematology', 238, TRUE),

  -- General Surgery (GS) + subs
  ('General Surgery (GS)', 300, TRUE),
  ('Trauma Surgery', 305, TRUE),
  ('Surgical Critical Care', 310, TRUE),
  ('Pediatric Surgery', 315, TRUE),
  ('Surgical Oncology', 320, TRUE),
  ('Vascular Surgery', 325, TRUE),

  -- Pediatrics (Peds) + subs
  ('Pediatrics (Peds)', 400, TRUE),
  ('Neonatology (NICU)', 405, TRUE),
  ('Pediatric Cardiology', 410, TRUE),
  ('Pediatric Hematology-Oncology', 415, TRUE),
  ('Adolescent Medicine', 420, TRUE),

  -- Obstetrics & Gynecology (OB/GYN) + subs
  ('Obstetrics & Gynecology (OB/GYN)', 500, TRUE),
  ('Maternal-Fetal Medicine (High-Risk Pregnancy)', 505, TRUE),
  ('Reproductive Endocrinology (Infertility)', 510, TRUE),
  ('Gynecologic Oncology', 515, TRUE),
  ('Labor & Delivery', 520, TRUE),

  -- 2. Surgical & interventional specialists (dedicated ORs / labs)
  ('Orthopedic Surgery', 600, TRUE),
  ('Neurological Surgery (Neurosurgery)', 605, TRUE),
  ('Anesthesiology', 610, TRUE),
  ('Critical Care Anesthesiology', 612, TRUE),
  ('Pain Medicine (Anesthesiology)', 615, TRUE),
  ('Ophthalmology', 620, TRUE),
  ('Otolaryngology (ENT) — Head & Neck Surgery', 625, TRUE),
  ('Urology', 630, TRUE),
  ('Plastic & Reconstructive Surgery', 635, TRUE),
  ('Cardiothoracic Surgery', 640, TRUE),
  ('Operating Room (OR)', 645, TRUE),
  ('Post-Anesthesia Care Unit (PACU)', 650, TRUE),

  -- 3. Diagnostic & support
  ('Diagnostic Radiology (X-ray, CT, MRI, Ultrasound)', 700, TRUE),
  ('Interventional Radiology', 705, TRUE),
  ('Anatomic Pathology (Biopsies & Autopsy)', 710, TRUE),
  ('Clinical Pathology — Lab (Blood Bank, Microbiology, Chemistry)', 715, TRUE),
  ('Blood Bank / Transfusion Services', 720, TRUE),
  ('Nuclear Medicine', 725, TRUE),

  -- 4. Focused & chronic care
  ('Neurology', 800, TRUE),
  ('Psychiatry', 805, TRUE),
  ('Addiction Medicine', 810, TRUE),
  ('Child & Adolescent Psychiatry', 815, TRUE),
  ('Dermatology', 820, TRUE),
  ('Physical Medicine & Rehabilitation (PM&R) / Physiatry', 825, TRUE),
  ('Radiation Oncology', 830, TRUE),
  ('Medical Oncology (Chemotherapy)', 835, TRUE),
  ('Medical Genetics', 840, TRUE),

  -- Acute & step-down units (often cross-cutting)
  ('Intensive Care Unit (ICU)', 900, TRUE),
  ('Critical Care', 905, TRUE),
  ('Telemetry', 910, TRUE),
  ('Step-Down Unit', 915, TRUE),
  ('Medical-Surgical Unit', 920, TRUE),

  -- Allied health & support (commonly separate cost centers)
  ('Pharmacy', 950, TRUE),
  ('Physical Therapy', 955, TRUE),
  ('Occupational Therapy', 960, TRUE),
  ('Speech-Language Pathology', 965, TRUE),
  ('Respiratory Therapy', 970, TRUE),
  ('Nutrition & Dietary', 975, TRUE),
  ('Social Work / Case Management', 980, TRUE),

  -- Primary care, community, hospital operations
  ('Family Medicine', 1000, TRUE),
  ('Primary Care', 1005, TRUE),
  ('Geriatrics', 1010, TRUE),
  ('Palliative Care / Hospice', 1015, TRUE),
  ('Infection Prevention & Control', 1020, TRUE),
  ('Quality & Patient Safety', 1025, TRUE),
  ('Hospital Administration', 1030, TRUE),
  ('Health Information Management', 1035, TRUE),
  ('Facilities & Engineering', 1040, TRUE),
  ('Environmental Services', 1045, TRUE),
  ('Security', 1050, TRUE),
  ('Chaplaincy / Spiritual Care', 1055, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Match legacy free-text to catalog names only when profiles.department exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'department'
  ) THEN
    UPDATE public.profiles p
    SET department_id = d.id
    FROM public.institution_departments d
    WHERE p.department_id IS NULL
      AND p.department IS NOT NULL
      AND TRIM(BOTH FROM p.department) = d.name;
  END IF;
END $$;

-- Required for RLS policies below; safe if already defined in earlier migrations.
CREATE OR REPLACE FUNCTION public.is_hospital_manager()
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
      AND p.role = 'hospital_manager'
  );
$$;

ALTER TABLE public.institution_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institution_departments_select" ON public.institution_departments;
CREATE POLICY "institution_departments_select"
  ON public.institution_departments
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE OR public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_departments_write" ON public.institution_departments;
CREATE POLICY "institution_departments_write"
  ON public.institution_departments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_departments_update" ON public.institution_departments;
CREATE POLICY "institution_departments_update"
  ON public.institution_departments
  FOR UPDATE
  TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "institution_departments_delete" ON public.institution_departments;
CREATE POLICY "institution_departments_delete"
  ON public.institution_departments
  FOR DELETE
  TO authenticated
  USING (public.is_hospital_manager());
