-- Expanded staff roles + encounter permission enforcement

-- Ensure profiles role constraint supports expanded hospital roles.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role IN (
      'patient',
      'hospital_manager',
      'chief_medical_officer',
      'attending_physician',
      'medical_doctor',
      'resident_physician',
      'nurse_practitioner',
      'physician_assistant',
      'registered_nurse',
      'nurse',
      'licensed_practical_nurse',
      'radiologist',
      'pharmacist',
      'lab_technician',
      'respiratory_therapist',
      'physical_therapist',
      'unit_clerk',
      'admin_staff'
    )
  );

-- Keep new-user provisioning aligned with expanded role set.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');

  IF lower(NEW.email) = 'dylanmwoodruff@icloud.com' THEN
    assigned_role := 'hospital_manager';
  END IF;

  IF assigned_role NOT IN (
    'patient',
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician',
    'medical_doctor',
    'resident_physician',
    'nurse_practitioner',
    'physician_assistant',
    'registered_nurse',
    'nurse',
    'licensed_practical_nurse',
    'radiologist',
    'pharmacist',
    'lab_technician',
    'respiratory_therapist',
    'physical_therapist',
    'unit_clerk',
    'admin_staff'
  ) THEN
    assigned_role := 'patient';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent unauthorized users from finalizing charts or submitting treatment plans.
CREATE OR REPLACE FUNCTION public.enforce_encounter_role_permissions()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  can_finalize BOOLEAN := FALSE;
  can_submit_plan BOOLEAN := FALSE;
BEGIN
  -- Service-role/system updates are allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  can_finalize := actor_role IN (
    'hospital_manager',
    'chief_medical_officer',
    'attending_physician',
    'medical_doctor',
    'resident_physician',
    'nurse_practitioner',
    'physician_assistant'
  );

  can_submit_plan := can_finalize;

  IF (
    NEW.final_treatment_plan IS DISTINCT FROM OLD.final_treatment_plan
    OR NEW.final_diagnosis_code IS DISTINCT FROM OLD.final_diagnosis_code
    OR NEW.final_diagnosis_description IS DISTINCT FROM OLD.final_diagnosis_description
  ) AND NOT can_submit_plan THEN
    RAISE EXCEPTION 'Your role (%) cannot submit final diagnosis/treatment plans.', COALESCE(actor_role, 'unknown');
  END IF;

  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' AND NOT can_finalize THEN
    RAISE EXCEPTION 'Your role (%) cannot finalize encounters.', COALESCE(actor_role, 'unknown');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_encounter_role_permissions_trigger ON public.encounters;
CREATE TRIGGER enforce_encounter_role_permissions_trigger
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_encounter_role_permissions();
