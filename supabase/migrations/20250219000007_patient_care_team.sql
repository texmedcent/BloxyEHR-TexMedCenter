-- Patient care team: providers assigned to a patient via encounter edits, documentation, etc.
-- Multiple providers can be on a patient's care team.

CREATE TABLE IF NOT EXISTS public.patient_care_team (
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_via TEXT NOT NULL CHECK (added_via IN (
    'encounter_assign',
    'encounter_edit',
    'documentation',
    'order',
    'disposition'
  )),
  PRIMARY KEY (patient_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_care_team_patient
  ON public.patient_care_team (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_care_team_provider
  ON public.patient_care_team (provider_id);

ALTER TABLE public.patient_care_team ENABLE ROW LEVEL SECURITY;

-- Staff can read care team for any patient (for chart display).
DROP POLICY IF EXISTS "Staff can read patient care team" ON public.patient_care_team;
CREATE POLICY "Staff can read patient care team"
  ON public.patient_care_team
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Staff can add themselves to a patient's care team.
DROP POLICY IF EXISTS "Staff can add self to care team" ON public.patient_care_team;
CREATE POLICY "Staff can add self to care team"
  ON public.patient_care_team
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff() AND provider_id = auth.uid());

-- Allow upsert for "add self" flow (insert or update added_at on conflict).
-- RLS: WITH CHECK ensures provider_id = auth.uid() for insert.
-- No UPDATE policy needed if we only use INSERT ... ON CONFLICT DO UPDATE for upsert.
-- But ON CONFLICT DO UPDATE requires UPDATE privilege. Add an UPDATE policy for self-only.
DROP POLICY IF EXISTS "Staff can update own care team entry" ON public.patient_care_team;
CREATE POLICY "Staff can update own care team entry"
  ON public.patient_care_team
  FOR UPDATE
  TO authenticated
  USING (public.is_staff() AND provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());
