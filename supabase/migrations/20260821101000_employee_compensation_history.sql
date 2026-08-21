-- ============================================================
-- Migration: Employee Compensation History and Salary Versioning
-- Timestamp: 20260821101000_employee_compensation_history.sql
-- Purpose:
--   Supports versioned employee compensation history with effective dates
--   (first day of month YYYY-MM-01) and explicit payroll eligibility.
--   Enforces strictly positive base salaries and non-negative allowances.
--   Preserves historical compensation records without overwriting.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_compensation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary NUMERIC(15, 2) NOT NULL CHECK (base_salary > 0),
  allowances NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  effective_from DATE NOT NULL CHECK (EXTRACT(DAY FROM effective_from) = 1),
  payroll_eligible BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_compensation_history_user_effective UNIQUE (user_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_compensation_history_user_effective
  ON public.employee_compensation_history(user_id, effective_from DESC);

-- Enable RLS and lock down permissions to backend service_role only
ALTER TABLE public.employee_compensation_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_compensation_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.employee_compensation_history TO service_role;

-- Legacy compensation settings have no effective date. Preserve the source
-- record's creation month as the explicit V1 baseline instead of inventing a
-- fixed API fallback date.
INSERT INTO public.employee_compensation_history (
  user_id,
  base_salary,
  allowances,
  effective_from,
  payroll_eligible,
  updated_by_user_id,
  created_at,
  updated_at
)
SELECT
  user_id,
  base_salary,
  allowances,
  date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  true,
  updated_by_user_id,
  created_at,
  updated_at
FROM public.employee_compensation_settings
ON CONFLICT (user_id, effective_from) DO NOTHING;

-- Helper function to resolve effective compensation for a given month
CREATE OR REPLACE FUNCTION public.get_effective_employee_compensation(p_user_id UUID, p_effective_date DATE)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  base_salary NUMERIC(15, 2),
  allowances NUMERIC(15, 2),
  effective_from DATE,
  payroll_eligible BOOLEAN,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT h.id, h.user_id, h.base_salary, h.allowances, h.effective_from, h.payroll_eligible, h.notes
  FROM public.employee_compensation_history h
  WHERE h.user_id = p_user_id
    AND h.effective_from <= p_effective_date
  ORDER BY h.effective_from DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_effective_employee_compensation(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_employee_compensation(UUID, DATE) TO service_role;
