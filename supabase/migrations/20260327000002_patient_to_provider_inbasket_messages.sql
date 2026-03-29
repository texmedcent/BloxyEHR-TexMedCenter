-- Allow patients to send portal messages to providers via in_basket_tasks.
-- Keep scope strict: only "Patient Message:*" rows for the sender's own patient record.

DROP POLICY IF EXISTS "Patients can send provider inbasket messages" ON public.in_basket_tasks;
CREATE POLICY "Patients can send provider inbasket messages"
  ON public.in_basket_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND title ILIKE 'Patient Message:%'
    AND status = 'open'
    AND encounter_id IS NULL
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = in_basket_tasks.patient_id
        AND p.auth_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles owner_profile
      WHERE owner_profile.id = in_basket_tasks.owner_id
        AND owner_profile.role <> 'patient'
    )
  );

DROP POLICY IF EXISTS "Patients can read own sent inbasket messages" ON public.in_basket_tasks;
CREATE POLICY "Patients can read own sent inbasket messages"
  ON public.in_basket_tasks
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND title ILIKE 'Patient Message:%'
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = in_basket_tasks.patient_id
        AND p.auth_user_id = auth.uid()
    )
  );
