-- Role system expansion + manager override + institution management support

-- Add email to profiles for manager user management UI
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill profile emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email <> u.email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles(email)
  WHERE email IS NOT NULL;

-- Normalize legacy roles before applying the new constraint
UPDATE public.profiles SET role = 'medical_doctor' WHERE role = 'physician';
UPDATE public.profiles SET role = 'hospital_manager' WHERE role = 'admin';

-- Expand role constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role IN (
      'patient',
      'hospital_manager',
      'medical_doctor',
      'physician_assistant',
      'nurse',
      'radiologist',
      'pharmacist',
      'lab_technician',
      'admin_staff'
    )
  );

-- Helper function to check manager role safely in RLS policies
CREATE OR REPLACE FUNCTION public.is_hospital_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'hospital_manager'
  );
$$;

-- Replace signup trigger to default new users as patient and promote specific manager email
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
    'medical_doctor',
    'physician_assistant',
    'nurse',
    'radiologist',
    'pharmacist',
    'lab_technician',
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

-- Ensure manager can update other users' roles
DROP POLICY IF EXISTS "Managers can update profiles" ON public.profiles;
CREATE POLICY "Managers can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_hospital_manager())
  WITH CHECK (true);

-- Promote existing manager account immediately if already present
UPDATE public.profiles p
SET role = 'hospital_manager'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'dylanmwoodruff@icloud.com';
