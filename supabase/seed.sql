-- BloxyEHR Seed Data (run after migrations)
-- Note: Run this manually or via Supabase SQL Editor after creating users

-- Sample patients (IDs will be generated)
INSERT INTO public.patients (mrn, first_name, last_name, dob, gender, contact_info, allergies) VALUES
  ('MRN001', 'Alex', 'Johnson', '1990-05-15', 'male', '{"phone": "555-0101", "email": "alex.j@email.com"}', '[]'),
  ('MRN002', 'Sam', 'Williams', '1985-11-22', 'female', '{"phone": "555-0102"}', '[{"allergen": "Penicillin", "reaction": "Rash"}]'),
  ('MRN003', 'Jordan', 'Smith', '2000-03-08', 'other', '{}', '[]'),
  ('MRN004', 'Taylor', 'Brown', '1978-07-30', 'female', '{"phone": "555-0104"}', '[{"allergen": "Latex", "reaction": "Hives"}]'),
  ('MRN005', 'Casey', 'Davis', '1995-01-12', 'male', '{}', '[]')
ON CONFLICT (mrn) DO NOTHING;

-- Note: vital_signs, encounters, etc. can be added once you have patient UUIDs
-- You may need to run: SELECT id, mrn FROM patients; and use those IDs
