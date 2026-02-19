-- Fix controlled-substance validation to avoid blocking unrelated updates
-- (e.g. med reconciliation or discontinuation) after initial verification.

CREATE OR REPLACE FUNCTION public.validate_controlled_substance_order()
RETURNS TRIGGER AS $$
DECLARE
  expected_code TEXT;
  entered_code TEXT;
  already_verified BOOLEAN;
BEGIN
  already_verified := COALESCE(OLD.controlled_substance_verified_at IS NOT NULL, FALSE);

  IF NEW.type = 'med' AND NEW.is_controlled_substance THEN
    -- If previously verified, allow regular updates without requiring code again.
    IF already_verified THEN
      IF NEW.details ? 'controlled_code' THEN
        NEW.details := NEW.details - 'controlled_code';
      END IF;
      RETURN NEW;
    END IF;

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
