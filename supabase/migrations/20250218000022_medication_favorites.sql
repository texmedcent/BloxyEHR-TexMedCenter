-- Persist medication favorites for ICD-like medication picker.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medication_favorites JSONB NOT NULL DEFAULT '[]'::jsonb;
