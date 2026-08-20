-- ============================================================
-- Migration: Enterprise Payroll Module V1
-- Timestamp: 20260820131000_payroll_v1.sql
-- Entities:
--   1. payroll_runs (Business Code: BL_01...)
--   2. payslips (Business Code: PL_01...)
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code TEXT UNIQUE,
  period_month TEXT NOT NULL CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$'),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'locked')),
  total_gross_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_net_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_employees_count INT NOT NULL DEFAULT 0,
  approved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_code TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payroll_runs_code_format
    CHECK (run_code IS NULL OR run_code ~ '^BL_[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs(period_month DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_approved_by ON public.payroll_runs(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_created_by ON public.payroll_runs(created_by);

CREATE SEQUENCE IF NOT EXISTS public.payroll_runs_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_payroll_run_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.run_code IS NULL OR NEW.run_code = '' THEN
    NEW.run_code := 'BL_' || LPAD(nextval('public.payroll_runs_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_payroll_run_code ON public.payroll_runs;
CREATE TRIGGER trg_generate_payroll_run_code
  BEFORE INSERT ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_payroll_run_code();

-- Companion code sync for payroll_runs
CREATE OR REPLACE FUNCTION public.tg_sync_payroll_runs_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.approved_by_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.approved_by_user_code FROM public.profiles WHERE id = NEW.approved_by_user_id;
  ELSE
    NEW.approved_by_user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payroll_runs_companion_codes ON public.payroll_runs;
CREATE TRIGGER trg_sync_payroll_runs_companion_codes
  BEFORE INSERT OR UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_payroll_runs_companion_codes();

-- Immutability guard on run_code
CREATE OR REPLACE FUNCTION public.prevent_payroll_run_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.run_code IS NOT NULL AND NEW.run_code IS DISTINCT FROM OLD.run_code THEN
    RAISE EXCEPTION 'run_code is immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_payroll_run_code ON public.payroll_runs;
CREATE TRIGGER trg_immutable_payroll_run_code
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payroll_run_code_update();

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payroll_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payroll_runs TO service_role;

-- Payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_code TEXT UNIQUE,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  payroll_run_code TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  user_code TEXT,
  employee_profile_id UUID REFERENCES public.employee_profiles(user_id) ON DELETE SET NULL,
  standard_working_days NUMERIC(5, 2) NOT NULL DEFAULT 22,
  actual_worked_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  paid_leave_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  unpaid_leave_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  base_salary NUMERIC(15, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(15, 2) NOT NULL DEFAULT 0,
  overtime_pay NUMERIC(15, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(15, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gross_salary NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_run_user UNIQUE(payroll_run_id, user_id),
  CONSTRAINT chk_payslips_code_format
    CHECK (payslip_code IS NULL OR payslip_code ~ '^PL_[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run_id ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON public.payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_profile_id ON public.payslips(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_payslips_payment_status ON public.payslips(payment_status);

CREATE SEQUENCE IF NOT EXISTS public.payslips_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_payslip_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payslip_code IS NULL OR NEW.payslip_code = '' THEN
    NEW.payslip_code := 'PL_' || LPAD(nextval('public.payslips_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_payslip_code ON public.payslips;
CREATE TRIGGER trg_generate_payslip_code
  BEFORE INSERT ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_payslip_code();

-- Companion sync for payslips
CREATE OR REPLACE FUNCTION public.tg_sync_payslips_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payroll_run_id IS NOT NULL THEN
    SELECT run_code INTO NEW.payroll_run_code FROM public.payroll_runs WHERE id = NEW.payroll_run_id;
  ELSE
    NEW.payroll_run_code := NULL;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.user_code FROM public.profiles WHERE id = NEW.user_id;
  ELSE
    NEW.user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payslips_companion_codes ON public.payslips;
CREATE TRIGGER trg_sync_payslips_companion_codes
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_payslips_companion_codes();

-- Immutability guard on payslip_code
CREATE OR REPLACE FUNCTION public.prevent_payslip_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.payslip_code IS NOT NULL AND NEW.payslip_code IS DISTINCT FROM OLD.payslip_code THEN
    RAISE EXCEPTION 'payslip_code is immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_payslip_code ON public.payslips;
CREATE TRIGGER trg_immutable_payslip_code
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payslip_code_update();

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payslips FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payslips TO service_role;
