ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS differential_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS final_diagnosis_code TEXT,
  ADD COLUMN IF NOT EXISTS final_diagnosis_description TEXT,
  ADD COLUMN IF NOT EXISTS final_treatment_plan TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_updated_at TIMESTAMPTZ;
