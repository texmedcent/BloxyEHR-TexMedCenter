-- Patient MyChart: appointment booking metadata + patient care team read access
-- Idempotent: can run on a nearly empty DB (creates `patients` + `appointments` base if missing).

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT,
  contact_info JSONB DEFAULT '{}',
  allergies JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_mrn ON public.patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(last_name, first_name);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES auth.users(id),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_provider ON public.appointments(provider_id);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS patient_reason TEXT,
  ADD COLUMN IF NOT EXISTS booking_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.appointments.booking_meta IS 'Pre-visit checklist snapshot, visit_mode, specialty filters, etc.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'patient_care_team'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patients'
      AND column_name = 'auth_user_id'
  ) THEN
    DROP POLICY IF EXISTS "Patients can read own care team" ON public.patient_care_team;
    CREATE POLICY "Patients can read own care team"
      ON public.patient_care_team
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.patients p
          WHERE p.id = patient_care_team.patient_id
            AND p.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
