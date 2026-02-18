-- Patient problem list
CREATE TABLE IF NOT EXISTS public.patient_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'inactive')),
  onset_date DATE,
  resolved_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_problems_patient ON public.patient_problems(patient_id);
ALTER TABLE public.patient_problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage patient_problems" ON public.patient_problems;
CREATE POLICY "Authenticated users can manage patient_problems" ON public.patient_problems
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger: create In Basket item when a result is inserted
CREATE OR REPLACE FUNCTION public.handle_new_result()
RETURNS TRIGGER AS $$
DECLARE
  ordering_provider UUID;
BEGIN
  -- Get the provider who ordered (if linked to order)
  IF NEW.order_id IS NOT NULL THEN
    SELECT ordered_by INTO ordering_provider
    FROM public.orders WHERE id = NEW.order_id;
  END IF;

  -- If we have an ordering provider, notify them
  IF ordering_provider IS NOT NULL THEN
    INSERT INTO public.in_basket_items (recipient_id, type, related_entity_id, priority)
    VALUES (ordering_provider, 'result', NEW.id, 'normal');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_result_created ON public.results;
CREATE TRIGGER on_result_created
  AFTER INSERT ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_result();
