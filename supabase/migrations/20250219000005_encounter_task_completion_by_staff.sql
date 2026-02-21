-- Allow any staff to complete or cancel encounter tasks.
-- Previously only the task owner or hospital manager could update.
-- This unblocks encounter finalization when tasks were auto-assigned to someone else
-- (e.g., critical result escalation to the orderer) and the closing provider needs to clear them.

DROP POLICY IF EXISTS "Users can manage own in_basket_tasks" ON public.in_basket_tasks;
CREATE POLICY "Users can manage own in_basket_tasks"
  ON public.in_basket_tasks
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_hospital_manager()
    OR (public.is_staff() AND encounter_id IS NOT NULL)
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_hospital_manager()
    OR (public.is_staff() AND encounter_id IS NOT NULL)
  );
