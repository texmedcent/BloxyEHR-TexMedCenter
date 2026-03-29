-- Ensure staff time tracking exists in environments where older staff dashboard migrations
-- were not applied (idempotent and safe to re-run).

CREATE TABLE IF NOT EXISTS public.staff_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id UUID,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_time_entries_user
  ON public.staff_time_entries(user_id, clock_in_at DESC);

ALTER TABLE public.staff_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage own time entries" ON public.staff_time_entries;
CREATE POLICY "Staff can manage own time entries" ON public.staff_time_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'staff_shifts'
  ) THEN
    ALTER TABLE public.staff_time_entries
      DROP CONSTRAINT IF EXISTS staff_time_entries_shift_id_fkey;
    ALTER TABLE public.staff_time_entries
      ADD CONSTRAINT staff_time_entries_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES public.staff_shifts(id) ON DELETE SET NULL;
  END IF;
END $$;
