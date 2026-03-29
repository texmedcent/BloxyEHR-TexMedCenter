-- Allow dynamic campus names managed from institution_campuses.
-- Older schema had a hardcoded campus check on patient_checkins.

ALTER TABLE public.patient_checkins
  DROP CONSTRAINT IF EXISTS patient_checkins_campus_check;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'patient_checkins'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%campus%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.patient_checkins DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END $$;
