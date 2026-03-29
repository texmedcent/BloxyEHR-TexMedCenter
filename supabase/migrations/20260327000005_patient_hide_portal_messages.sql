-- Let patients hide portal message threads in MyChart without deleting provider records.

ALTER TABLE public.in_basket_tasks
  ADD COLUMN IF NOT EXISTS patient_hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_in_basket_tasks_patient_hidden
  ON public.in_basket_tasks(owner_id, patient_hidden_at, created_at DESC);

DROP POLICY IF EXISTS "Patients can hide own sent portal messages" ON public.in_basket_tasks;
CREATE POLICY "Patients can hide own sent portal messages"
  ON public.in_basket_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      title ILIKE 'Patient Message:%'
      OR title ILIKE 'Provider Reply:%'
    )
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = in_basket_tasks.patient_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND (
      title ILIKE 'Patient Message:%'
      OR title ILIKE 'Provider Reply:%'
    )
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = in_basket_tasks.patient_id
        AND p.auth_user_id = auth.uid()
    )
  );
