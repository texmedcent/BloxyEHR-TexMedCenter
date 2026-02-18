ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS icd10_favorites JSONB NOT NULL DEFAULT '[]'::jsonb;
