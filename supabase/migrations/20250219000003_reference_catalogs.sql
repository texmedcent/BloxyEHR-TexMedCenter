-- Scalable reference catalogs for full ICD-10 and medication coverage.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.icd10_catalog (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category_key TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_icd10_catalog_active_code
  ON public.icd10_catalog (is_active, code);

CREATE INDEX IF NOT EXISTS idx_icd10_catalog_active_category
  ON public.icd10_catalog (is_active, category_key, code);

CREATE INDEX IF NOT EXISTS idx_icd10_catalog_label_trgm
  ON public.icd10_catalog USING GIN (label gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.medication_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name TEXT NOT NULL,
  brand_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  rxnorm_code TEXT,
  category_key TEXT,
  controlled BOOLEAN NOT NULL DEFAULT FALSE,
  default_route TEXT,
  default_frequency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_catalog_unique_generic
  ON public.medication_catalog (LOWER(generic_name));

CREATE INDEX IF NOT EXISTS idx_medication_catalog_active_name
  ON public.medication_catalog (is_active, generic_name);

CREATE INDEX IF NOT EXISTS idx_medication_catalog_active_category
  ON public.medication_catalog (is_active, category_key, generic_name);

CREATE INDEX IF NOT EXISTS idx_medication_catalog_generic_trgm
  ON public.medication_catalog USING GIN (generic_name gin_trgm_ops);

ALTER TABLE public.icd10_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read icd10 catalog" ON public.icd10_catalog;
CREATE POLICY "Staff can read icd10 catalog"
  ON public.icd10_catalog
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can read medication catalog" ON public.medication_catalog;
CREATE POLICY "Staff can read medication catalog"
  ON public.medication_catalog
  FOR SELECT
  TO authenticated
  USING (public.is_staff());
