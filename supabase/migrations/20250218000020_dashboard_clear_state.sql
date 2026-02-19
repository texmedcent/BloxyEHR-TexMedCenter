-- Persist per-user "clear" state for chart dashboard recent panels.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_orders_cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dashboard_results_cleared_at TIMESTAMPTZ;
