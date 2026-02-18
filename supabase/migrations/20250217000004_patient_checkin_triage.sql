-- Patient self check-in + triage queue

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.patient_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  campus TEXT NOT NULL CHECK (campus IN ('Primary Care Office', 'Emergency Room', 'Urgent Care')),
  status TEXT NOT NULL DEFAULT 'triage' CHECK (status IN ('triage', 'in_encounter', 'completed', 'cancelled')),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  triaged_at TIMESTAMPTZ,
  triaged_by UUID REFERENCES auth.users(id),
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_checkins_status ON public.patient_checkins(status, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_auth_user ON public.patient_checkins(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_patient ON public.patient_checkins(patient_id);

ALTER TABLE public.patient_checkins ENABLE ROW LEVEL SECURITY;

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
      AND p.role <> 'patient'
  );
$$;

DROP POLICY IF EXISTS "Patients can insert own checkins" ON public.patient_checkins;
CREATE POLICY "Patients can insert own checkins"
  ON public.patient_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Patients can read own checkins" ON public.patient_checkins;
CREATE POLICY "Patients can read own checkins"
  ON public.patient_checkins
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can read all checkins" ON public.patient_checkins;
CREATE POLICY "Staff can read all checkins"
  ON public.patient_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can update checkins" ON public.patient_checkins;
CREATE POLICY "Staff can update checkins"
  ON public.patient_checkins
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (true);
