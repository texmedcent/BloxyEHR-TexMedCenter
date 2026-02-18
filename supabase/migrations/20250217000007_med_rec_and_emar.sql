-- Medication reconciliation metadata on orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS med_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS med_reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS med_reconciled_by_name TEXT;

-- eMAR / administration log for medication orders.
CREATE TABLE IF NOT EXISTS public.med_admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('administered', 'not_given')),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  documented_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  documented_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_admin_log_order_id ON public.med_admin_log(order_id);
CREATE INDEX IF NOT EXISTS idx_med_admin_log_patient_id ON public.med_admin_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_med_admin_log_event_at ON public.med_admin_log(event_at DESC);

ALTER TABLE public.med_admin_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage med_admin_log" ON public.med_admin_log;
CREATE POLICY "Authenticated users can manage med_admin_log" ON public.med_admin_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
