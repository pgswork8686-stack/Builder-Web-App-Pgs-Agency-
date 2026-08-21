-- ============================================================
-- Migration: Employee compensation settings
-- Purpose: Persist the salary inputs used by payroll calculation.
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_compensation_settings (
  user_id UUID PRIMARY KEY REFERENCES public.employee_profiles(user_id) ON DELETE CASCADE,
  base_salary NUMERIC(15, 2) NOT NULL,
  allowances NUMERIC(15, 2) NOT NULL,
  updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_employee_compensation_base_salary_positive
    CHECK (base_salary > 0),
  CONSTRAINT chk_employee_compensation_allowances_nonnegative
    CHECK (allowances >= 0)
);

-- `user_id` is covered by the primary key. Keep the remaining foreign key
-- indexed for audit lookups and referential actions.
CREATE INDEX IF NOT EXISTS idx_employee_compensation_settings_updated_by
  ON public.employee_compensation_settings(updated_by_user_id);

ALTER TABLE public.employee_compensation_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_compensation_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.employee_compensation_settings TO service_role;
