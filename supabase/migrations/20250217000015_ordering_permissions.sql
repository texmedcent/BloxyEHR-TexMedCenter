-- Restrict ordering privileges to provider roles.
-- Non-provider staff can still document results and eMAR logs.

CREATE OR REPLACE FUNCTION public.enforce_ordering_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  -- Service-role/system writes are allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF actor_role NOT IN (
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician',
    'medical_doctor',
    'resident_physician',
    'nurse_practitioner',
    'physician_assistant'
  ) THEN
    RAISE EXCEPTION 'Your role (%) cannot place new orders.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_ordering_permissions_trigger ON public.orders;
CREATE TRIGGER enforce_ordering_permissions_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ordering_permissions();
