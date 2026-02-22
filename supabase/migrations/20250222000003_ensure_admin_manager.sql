-- Ensure dylanmwoodruff@icloud.com is always a hospital manager.
-- Handles: (1) new signups via handle_new_user in 20250217000014
--          (2) existing users who signed up before that migration

UPDATE public.profiles p
SET role = 'hospital_manager'
FROM auth.users u
WHERE p.id = u.id
  AND lower(trim(u.email)) = 'dylanmwoodruff@icloud.com'
  AND COALESCE(p.role, '') <> 'hospital_manager';
