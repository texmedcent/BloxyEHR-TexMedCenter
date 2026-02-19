-- Employee team chat (staff-only)

CREATE TABLE IF NOT EXISTS public.employee_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_chat_created_at
  ON public.employee_chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_chat_sender_id
  ON public.employee_chat_messages(sender_id, created_at DESC);

ALTER TABLE public.employee_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read employee chat" ON public.employee_chat_messages;
CREATE POLICY "Staff can read employee chat"
  ON public.employee_chat_messages
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can send employee chat" ON public.employee_chat_messages;
CREATE POLICY "Staff can send employee chat"
  ON public.employee_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
    AND char_length(message) BETWEEN 1 AND 2000
  );

DROP POLICY IF EXISTS "Staff can delete own chat messages" ON public.employee_chat_messages;
CREATE POLICY "Staff can delete own chat messages"
  ON public.employee_chat_messages
  FOR DELETE
  TO authenticated
  USING (public.is_staff() AND sender_id = auth.uid());
