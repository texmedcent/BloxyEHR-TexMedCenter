-- Allow hospital managers to manage ICD-10 catalog additions from Institution Settings.

DROP POLICY IF EXISTS "Managers can manage icd10 catalog" ON public.icd10_catalog;
CREATE POLICY "Managers can manage icd10 catalog"
  ON public.icd10_catalog
  FOR ALL
  TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (public.is_hospital_manager());
