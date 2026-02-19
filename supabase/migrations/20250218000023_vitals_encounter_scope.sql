-- Scope vitals to encounters so vitals disappear once encounter is ended.

ALTER TABLE public.vital_signs
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL;

-- Backfill where possible to the most recent active encounter for the same patient.
UPDATE public.vital_signs vs
SET encounter_id = e.id
FROM public.encounters e
WHERE vs.encounter_id IS NULL
  AND e.patient_id = vs.patient_id
  AND e.status = 'active';

CREATE INDEX IF NOT EXISTS idx_vital_signs_encounter
  ON public.vital_signs(encounter_id, recorded_at DESC);
