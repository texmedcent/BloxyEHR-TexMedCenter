ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS workflow_status TEXT
    CHECK (workflow_status IN ('awaiting_provider', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS encounter_display_id TEXT,
  ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_updated_by_name TEXT,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervising_attending TEXT;

UPDATE public.encounters
SET workflow_status = CASE
  WHEN status = 'completed' THEN 'completed'
  ELSE 'awaiting_provider'
END
WHERE workflow_status IS NULL;

UPDATE public.encounters
SET encounter_display_id = 'ENC-' || upper(left(id::text, 8))
WHERE encounter_display_id IS NULL;

CREATE TABLE IF NOT EXISTS public.encounter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encounter_audit_log_encounter_id
  ON public.encounter_audit_log(encounter_id);

CREATE INDEX IF NOT EXISTS idx_encounter_audit_log_created_at
  ON public.encounter_audit_log(created_at DESC);

ALTER TABLE public.encounter_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage encounter_audit_log" ON public.encounter_audit_log;
CREATE POLICY "Authenticated users can manage encounter_audit_log" ON public.encounter_audit_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
