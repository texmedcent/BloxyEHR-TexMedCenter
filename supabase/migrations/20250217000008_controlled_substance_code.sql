CREATE TABLE IF NOT EXISTS public.institution_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  controlled_substance_code TEXT NOT NULL DEFAULT 'BLOXY-RX-001',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.institution_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read institution_settings" ON public.institution_settings;
CREATE POLICY "Authenticated users can read institution_settings" ON public.institution_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Hospital managers can update institution_settings" ON public.institution_settings;
CREATE POLICY "Hospital managers can update institution_settings" ON public.institution_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'hospital_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'hospital_manager'
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_controlled_substance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS controlled_substance_verified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.validate_controlled_substance_order()
RETURNS TRIGGER AS $$
DECLARE
  expected_code TEXT;
  entered_code TEXT;
BEGIN
  IF NEW.type = 'med' AND NEW.is_controlled_substance THEN
    SELECT controlled_substance_code
      INTO expected_code
    FROM public.institution_settings
    WHERE id = 1;

    entered_code := COALESCE(NEW.details->>'controlled_code', '');

    IF expected_code IS NULL OR length(trim(expected_code)) = 0 THEN
      RAISE EXCEPTION 'Institution controlled-substance code is not configured.';
    END IF;

    IF entered_code <> expected_code THEN
      RAISE EXCEPTION 'Invalid controlled-substance authorization code.';
    END IF;

    NEW.details := NEW.details - 'controlled_code';
    NEW.controlled_substance_verified_at := NOW();
  ELSE
    NEW.controlled_substance_verified_at := NULL;
    IF NEW.details ? 'controlled_code' THEN
      NEW.details := NEW.details - 'controlled_code';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS validate_controlled_substance_order_trigger ON public.orders;
CREATE TRIGGER validate_controlled_substance_order_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_controlled_substance_order();
