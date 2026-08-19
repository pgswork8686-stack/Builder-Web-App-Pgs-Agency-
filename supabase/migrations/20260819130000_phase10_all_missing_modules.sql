-- ============================================================
-- Migration: Phase 10 - Complete Functional Schemas for All Figma Modules
-- Timestamp: 20260819130000_phase10_all_missing_modules.sql
-- Modules:
--   1. project_expenses (CP_01...) - Project expense requests & reimbursements
--   2. payroll_runs (BL_01...) & payslips (PL_01...) - Enterprise payroll
--   3. company_documents (TL_01...) - Company-wide document library
--   4. support_tickets (YC_01...) & support_ticket_messages - Support desk
--   5. system_settings - Persistent system configuration
-- ============================================================

-- ============================================================
-- 1. PROJECT EXPENSES (CP_01...)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON public.project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_submitted_by ON public.project_expenses(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_status ON public.project_expenses(status);
CREATE INDEX IF NOT EXISTS idx_project_expenses_expense_date ON public.project_expenses(expense_date DESC);

CREATE SEQUENCE IF NOT EXISTS public.project_expenses_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_project_expense_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
AS $$
BEGIN
  -- project_code
  IF NEW.project_id IS NOT NULL THEN
    SELECT project_code INTO NEW.project_code FROM public.projects WHERE id = NEW.project_id;
  ELSE
    NEW.project_code := NULL;
  END IF;

  -- submitted_by_user_code
  IF NEW.submitted_by_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.submitted_by_user_code FROM public.profiles WHERE id = NEW.submitted_by_user_id;
  ELSE
    NEW.submitted_by_user_code := NULL;
  END IF;

  -- approved_by_user_code
  IF NEW.approved_by_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.approved_by_user_code FROM public.profiles WHERE id = NEW.approved_by_user_id;
  ELSE
    NEW.approved_by_user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_expenses_companion_codes ON public.project_expenses;
CREATE TRIGGER trg_sync_project_expenses_companion_codes
  BEFORE INSERT OR UPDATE ON public.project_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_project_expenses_companion_codes();

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ENTERPRISE PAYROLL (payroll_runs: BL_01..., payslips: PL_01...)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs(period_month DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(status);

CREATE SEQUENCE IF NOT EXISTS public.payroll_runs_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_payroll_run_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
AS $$
BEGIN
  IF NEW.approved_by_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.approved_by_user_code FROM public.profiles WHERE id = NEW.approved_by_user_id;
  ELSE
    NEW.approved_by_user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payroll_runs_companion_codes ON public.payroll_runs;
CREATE TRIGGER trg_sync_payroll_runs_companion_codes
  BEFORE INSERT OR UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_payroll_runs_companion_codes();

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_code TEXT UNIQUE,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  payroll_run_code TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  user_code TEXT,
  employee_profile_id UUID REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payroll_run_user UNIQUE(payroll_run_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run_id ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON public.payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_payment_status ON public.payslips(payment_status);

CREATE SEQUENCE IF NOT EXISTS public.payslips_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_payslip_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
AS $$
BEGIN
  IF NEW.payroll_run_id IS NOT NULL THEN
    SELECT run_code INTO NEW.payroll_run_code FROM public.payroll_runs WHERE id = NEW.payroll_run_id;
  ELSE
    NEW.payroll_run_code := NULL;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.user_code FROM public.profiles WHERE id = NEW.user_id;
  ELSE
    NEW.user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payslips_companion_codes ON public.payslips;
CREATE TRIGGER trg_sync_payslips_companion_codes
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_payslips_companion_codes();

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. COMPANY DOCUMENTS (TL_01...)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('policy_procedure', 'contract_template', 'marketing_asset', 'brand_guidelines', 'financial_report', 'general')),
  storage_bucket TEXT NOT NULL DEFAULT 'company-documents',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'public_company' CHECK (access_level IN ('public_company', 'internal_only', 'management_only')),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  department_code TEXT,
  uploaded_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_by_user_code TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  delete_status TEXT NOT NULL DEFAULT 'active' CHECK (delete_status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_category ON public.company_documents(category);
CREATE INDEX IF NOT EXISTS idx_company_documents_access_level ON public.company_documents(access_level);
CREATE INDEX IF NOT EXISTS idx_company_documents_department_id ON public.company_documents(department_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_delete_status ON public.company_documents(delete_status);

CREATE SEQUENCE IF NOT EXISTS public.company_documents_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_company_document_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.document_code IS NULL OR NEW.document_code = '' THEN
    NEW.document_code := 'TL_' || LPAD(nextval('public.company_documents_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_company_document_code ON public.company_documents;
CREATE TRIGGER trg_generate_company_document_code
  BEFORE INSERT ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_company_document_code();

-- Companion sync for company_documents
CREATE OR REPLACE FUNCTION public.tg_sync_company_documents_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    SELECT department_code INTO NEW.department_code FROM public.departments WHERE id = NEW.department_id;
  ELSE
    NEW.department_code := NULL;
  END IF;

  IF NEW.uploaded_by_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.uploaded_by_user_code FROM public.profiles WHERE id = NEW.uploaded_by_user_id;
  ELSE
    NEW.uploaded_by_user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_documents_companion_codes ON public.company_documents;
CREATE TRIGGER trg_sync_company_documents_companion_codes
  BEFORE INSERT OR UPDATE ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_company_documents_companion_codes();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. SUPPORT TICKETS (YC_01...) & MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT UNIQUE,
  client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE CASCADE,
  client_company_code TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_code TEXT,
  creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  creator_user_code TEXT,
  assignee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_user_code TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'project_scope', 'bug_report', 'general')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client_company_id ON public.support_tickets(client_company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_project_id ON public.support_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_creator ON public.support_tickets(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON public.support_tickets(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

CREATE SEQUENCE IF NOT EXISTS public.support_tickets_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_support_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
    NEW.ticket_code := 'YC_' || LPAD(nextval('public.support_tickets_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_support_ticket_code ON public.support_tickets;
CREATE TRIGGER trg_generate_support_ticket_code
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_support_ticket_code();

-- Companion sync for support_tickets
CREATE OR REPLACE FUNCTION public.tg_sync_support_tickets_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_company_id IS NOT NULL THEN
    SELECT client_company_code INTO NEW.client_company_code FROM public.client_companies WHERE id = NEW.client_company_id;
  ELSE
    NEW.client_company_code := NULL;
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    SELECT project_code INTO NEW.project_code FROM public.projects WHERE id = NEW.project_id;
  ELSE
    NEW.project_code := NULL;
  END IF;

  IF NEW.creator_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.creator_user_code FROM public.profiles WHERE id = NEW.creator_user_id;
  ELSE
    NEW.creator_user_code := NULL;
  END IF;

  IF NEW.assignee_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.assignee_user_code FROM public.profiles WHERE id = NEW.assignee_user_id;
  ELSE
    NEW.assignee_user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_tickets_companion_codes ON public.support_tickets;
CREATE TRIGGER trg_sync_support_tickets_companion_codes
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_support_tickets_companion_codes();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Support Ticket Messages table
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  ticket_code TEXT,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sender_user_code TEXT,
  content TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_sender ON public.support_ticket_messages(sender_user_id);

-- Companion sync for support_ticket_messages
CREATE OR REPLACE FUNCTION public.tg_sync_support_ticket_messages_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT ticket_code INTO NEW.ticket_code FROM public.support_tickets WHERE id = NEW.ticket_id;
  ELSE
    NEW.ticket_code := NULL;
  END IF;

  IF NEW.sender_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.sender_user_code FROM public.profiles WHERE id = NEW.sender_user_id;
  ELSE
    NEW.sender_user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_ticket_messages_companion_codes ON public.support_ticket_messages;
CREATE TRIGGER trg_sync_support_ticket_messages_companion_codes
  BEFORE INSERT OR UPDATE ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_support_ticket_messages_companion_codes();

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. SYSTEM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('general', 'attendance', 'finance', 'security', 'notifications')),
  value JSONB NOT NULL,
  description TEXT,
  updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by_user_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- Companion sync for system_settings
CREATE OR REPLACE FUNCTION public.tg_sync_system_settings_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.updated_by_user_id IS NOT NULL THEN
    SELECT user_code INTO NEW.updated_by_user_code FROM public.profiles WHERE id = NEW.updated_by_user_id;
  ELSE
    NEW.updated_by_user_code := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_settings_companion_codes ON public.system_settings;
CREATE TRIGGER trg_sync_system_settings_companion_codes
  BEFORE INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_system_settings_companion_codes();

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Seed default initial system settings if empty
INSERT INTO public.system_settings (key, category, value, description)
VALUES
  ('company_info', 'general', '{"name": "PGS Agency Hub", "hotline": "1900 8686", "email": "contact@pgsagency.vn", "address": "TP. Hồ Chí Minh, Việt Nam"}'::jsonb, 'Thông tin liên hệ chung của công ty'),
  ('attendance_policy', 'attendance', '{"radius_meters": 150, "allow_remote": true, "work_start_time": "08:30", "work_end_time": "17:30"}'::jsonb, 'Quy định chấm công và geofencing'),
  ('finance_defaults', 'finance', '{"currency": "VND", "vat_rate": 10, "auto_invoice_reminder_days": 3}'::jsonb, 'Cấu hình mặc định tài chính và hóa đơn'),
  ('security_policy', 'security', '{"mfa_required": false, "session_timeout_hours": 24, "rate_limit_rpm": 120}'::jsonb, 'Cấu hình chính sách bảo mật hệ thống')
ON CONFLICT (key) DO NOTHING;
