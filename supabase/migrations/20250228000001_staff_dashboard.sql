-- Staff Dashboard: tables for directory, shifts, tasks, announcements, HR, inventory, events, feedback, quick links

-- 1.1 Staff shifts and availability
CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department TEXT,
  shift_type TEXT NOT NULL DEFAULT 'day' CHECK (shift_type IN ('day', 'evening', 'night')),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'worked', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_user ON public.staff_shifts(user_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_department ON public.staff_shifts(department, scheduled_start);

CREATE TABLE IF NOT EXISTS public.staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_shift_id UUID NOT NULL REFERENCES public.staff_shifts(id) ON DELETE CASCADE,
  requested_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);

-- 1.2 Clock-in/clock-out
CREATE TABLE IF NOT EXISTS public.staff_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.staff_shifts(id) ON DELETE SET NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_time_entries_user ON public.staff_time_entries(user_id, clock_in_at DESC);

-- 1.3 Department tasks (non-patient)
CREATE TABLE IF NOT EXISTS public.department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_tasks_dept ON public.department_tasks(department, status);
CREATE INDEX IF NOT EXISTS idx_department_tasks_assignee ON public.department_tasks(assignee_id, status);

-- 1.4 Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'hospital' CHECK (scope IN ('hospital', 'department')),
  department_key TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_scope ON public.announcements(scope, department_key, created_at DESC);

-- 1.5 Time-off requests
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'pto' CHECK (type IN ('pto', 'sick', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_time_off_requests_user ON public.time_off_requests(user_id, created_at DESC);

-- 1.6 Inventory
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'each',
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  requested_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Events
CREATE TABLE IF NOT EXISTS public.staff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  department_key TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  rsvp_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.staff_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_events_start ON public.staff_events(start_at);

-- 1.8 Feedback and polls
CREATE TABLE IF NOT EXISTS public.staff_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  department_key TEXT,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('feedback', 'poll_response')),
  content JSONB,
  poll_id UUID REFERENCES public.staff_polls(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_feedback_type ON public.staff_feedback(type, created_at DESC);

-- 1.9 Quick links
CREATE TABLE IF NOT EXISTS public.quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'resources' CHECK (category IN ('hr', 'policy', 'resources', 'chat')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can read/write own shifts, availability, time entries
DROP POLICY IF EXISTS "Staff can manage staff_shifts" ON public.staff_shifts;
CREATE POLICY "Staff can manage staff_shifts" ON public.staff_shifts
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can manage own availability" ON public.staff_availability;
CREATE POLICY "Staff can manage own availability" ON public.staff_availability
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can manage shift_swap_requests" ON public.shift_swap_requests;
CREATE POLICY "Staff can manage shift_swap_requests" ON public.shift_swap_requests
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can manage own time entries" ON public.staff_time_entries;
CREATE POLICY "Staff can manage own time entries" ON public.staff_time_entries
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid());

-- Department tasks: staff read all in their dept, managers create
DROP POLICY IF EXISTS "Staff can manage department_tasks" ON public.department_tasks;
CREATE POLICY "Staff can manage department_tasks" ON public.department_tasks
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Announcements: all staff read; managers create
DROP POLICY IF EXISTS "Staff can read announcements" ON public.announcements;
CREATE POLICY "Staff can read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Managers can manage announcements" ON public.announcements;
CREATE POLICY "Managers can manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (public.is_hospital_manager()) WITH CHECK (public.is_hospital_manager());

-- Time-off: own requests; managers approve
DROP POLICY IF EXISTS "Staff can manage own time_off" ON public.time_off_requests;
CREATE POLICY "Staff can manage own time_off" ON public.time_off_requests
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_hospital_manager())
  WITH CHECK (user_id = auth.uid() OR public.is_hospital_manager());

-- Inventory
DROP POLICY IF EXISTS "Staff can read inventory" ON public.inventory_items;
CREATE POLICY "Staff can read inventory" ON public.inventory_items
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Managers can manage inventory" ON public.inventory_items;
CREATE POLICY "Managers can manage inventory" ON public.inventory_items
  FOR ALL TO authenticated USING (public.is_hospital_manager()) WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "Staff can manage inventory_requests" ON public.inventory_requests;
CREATE POLICY "Staff can manage inventory_requests" ON public.inventory_requests
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Events
DROP POLICY IF EXISTS "Staff can read staff_events" ON public.staff_events;
CREATE POLICY "Staff can read staff_events" ON public.staff_events
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Managers can manage staff_events" ON public.staff_events;
CREATE POLICY "Managers can manage staff_events" ON public.staff_events
  FOR ALL TO authenticated USING (public.is_hospital_manager()) WITH CHECK (public.is_hospital_manager());

DROP POLICY IF EXISTS "Staff can manage own rsvps" ON public.staff_event_rsvps;
CREATE POLICY "Staff can manage own rsvps" ON public.staff_event_rsvps
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Feedback and polls
DROP POLICY IF EXISTS "Staff can submit feedback" ON public.staff_feedback;
CREATE POLICY "Staff can submit feedback" ON public.staff_feedback
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can read own feedback" ON public.staff_feedback;
CREATE POLICY "Staff can read own feedback" ON public.staff_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can read feedback" ON public.staff_feedback;
CREATE POLICY "Managers can read feedback" ON public.staff_feedback
  FOR SELECT TO authenticated USING (public.is_hospital_manager());

DROP POLICY IF EXISTS "Staff can read staff_polls" ON public.staff_polls;
CREATE POLICY "Staff can read staff_polls" ON public.staff_polls
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Managers can manage staff_polls" ON public.staff_polls;
CREATE POLICY "Managers can manage staff_polls" ON public.staff_polls
  FOR ALL TO authenticated USING (public.is_hospital_manager()) WITH CHECK (public.is_hospital_manager());

-- Quick links: all staff read; managers manage
DROP POLICY IF EXISTS "Staff can read quick_links" ON public.quick_links;
CREATE POLICY "Staff can read quick_links" ON public.quick_links
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Managers can manage quick_links" ON public.quick_links;
CREATE POLICY "Managers can manage quick_links" ON public.quick_links
  FOR ALL TO authenticated USING (public.is_hospital_manager()) WITH CHECK (public.is_hospital_manager());

-- Seed default quick links (only if empty)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.quick_links) = 0 THEN
    INSERT INTO public.quick_links (label, url, category, sort_order) VALUES
      ('Team Chat', '/chat', 'chat', 0),
      ('HR Portal', '#', 'hr', 10),
      ('Policy Documents', '#', 'policy', 20),
      ('Procedures Manual', '#', 'resources', 30),
      ('Training Modules', '#', 'hr', 40);
  END IF;
END $$;
