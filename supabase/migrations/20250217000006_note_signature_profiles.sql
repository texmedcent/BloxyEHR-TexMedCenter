ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature TEXT;

-- Sensible default for existing users; can be customized in Settings.
UPDATE public.profiles
SET signature = full_name
WHERE signature IS NULL
  AND full_name IS NOT NULL
  AND length(trim(full_name)) > 0;
