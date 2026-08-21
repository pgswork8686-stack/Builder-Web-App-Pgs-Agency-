-- ============================================================
-- Migration: Project Expenses Module V1
-- Timestamp: 20260820130000_project_expenses_v1.sql
-- Entity: project_expenses (Business Code: CP_01...)
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_code TEXT UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_code TEXT,
  submitted_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  submitted_by_user_code TEXT,
  title TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL DEFAULT 'VND',
  expense_category TEXT NOT NULL CHECK (expense_category IN ('travel', 'software_license', 'equipment', 'outsourcing', 'meal_entertainment', 'general')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
  receipt_url TEXT,
  notes TEXT,
  approved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_user_code TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_project_expenses_code_format
    CHECK (expense_code IS NULL OR expense_code ~ '^CP_[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON public.project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_submitted_by ON public.project_expenses(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_approved_by ON public.project_expenses(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_status ON public.project_expenses(status);
CREATE INDEX IF NOT EXISTS idx_project_expenses_expense_date ON public.project_expenses(expense_date DESC);

CREATE SEQUENCE IF NOT EXISTS public.project_expenses_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_project_expense_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.expense_code IS NULL OR NEW.expense_code = '' THEN
    NEW.expense_code := 'CP_' || LPAD(nextval('public.project_expenses_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_project_expense_code ON public.project_expenses;
CREATE TRIGGER trg_generate_project_expense_code
  BEFORE INSERT ON public.project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_project_expense_code();

-- Companion code sync for project_expenses
CREATE OR REPLACE FUNCTION public.tg_sync_project_expenses_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT project_code INTO NEW.project_code FROM public.projects WHERE id = NEW.project_id;
  ELSE
    NEW.project_code := NULL;
  END IF;

  IF NEW.submitted_by_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.submitted_by_user_code FROM public.profiles WHERE id = NEW.submitted_by_user_id;
  ELSE
    NEW.submitted_by_user_code := NULL;
  END IF;

  IF NEW.approved_by_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.approved_by_user_code FROM public.profiles WHERE id = NEW.approved_by_user_id;
  ELSE
    NEW.approved_by_user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_expenses_companion_codes ON public.project_expenses;
CREATE TRIGGER trg_sync_project_expenses_companion_codes
  BEFORE INSERT OR UPDATE ON public.project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_project_expenses_companion_codes();

-- Immutability guard on expense_code
CREATE OR REPLACE FUNCTION public.prevent_project_expense_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.expense_code IS NOT NULL AND NEW.expense_code IS DISTINCT FROM OLD.expense_code THEN
    RAISE EXCEPTION 'expense_code is immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_project_expense_code ON public.project_expenses;
CREATE TRIGGER trg_immutable_project_expense_code
  BEFORE UPDATE ON public.project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_expense_code_update();

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_expenses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.project_expenses TO service_role;
