-- Normalize existing vital type names so one patient/type can be uniquely enforced.
UPDATE public.vital_signs
SET type = lower(regexp_replace(trim(type), '[\s-]+', '_', 'g'))
WHERE type IS NOT NULL;

-- Keep only the most recently charted vital per patient + type.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id, type
      ORDER BY recorded_at DESC, id DESC
    ) AS rn
  FROM public.vital_signs
)
DELETE FROM public.vital_signs vs
USING ranked r
WHERE vs.id = r.id
  AND r.rn > 1;

-- Hard guarantee: one row per patient/type so charting updates existing vitals.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vital_signs_patient_type_unique
  ON public.vital_signs(patient_id, type);
