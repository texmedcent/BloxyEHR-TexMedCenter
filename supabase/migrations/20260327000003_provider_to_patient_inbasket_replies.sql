-- Allow providers/staff to reply to patients through in_basket_tasks.
-- Scope is constrained to "Provider Reply:*" portal message rows.

DROP POLICY IF EXISTS "Staff can send patient inbasket replies" ON public.in_basket_tasks;
CREATE POLICY "Staff can send patient inbasket replies"
  ON public.in_basket_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND created_by = auth.uid()
    AND title ILIKE 'Provider Reply:%'
    AND status = 'open'
    AND encounter_id IS NULL
    AND patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = in_basket_tasks.patient_id
        AND p.auth_user_id = in_basket_tasks.owner_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles owner_profile
      WHERE owner_profile.id = in_basket_tasks.owner_id
        AND owner_profile.role = 'patient'
    )
  );
