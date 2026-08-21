-- ============================================================
-- Migration: Add Transaction-Safe Human-Readable Business Codes
-- Timestamp: 20260818160000_add_business_codes.sql
-- Description: Creates generic business code generator, sequences,
-- triggers for auto-generation & immutability, format check constraints,
-- and collision-proof deterministic backfill for all entities.
-- ============================================================

-- 1. Generic Business Code Formatting Function
CREATE OR REPLACE FUNCTION public.format_business_code(prefix TEXT, seq_num BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT prefix || '_' || CASE
    WHEN seq_num < 10 THEN '0' || seq_num::text
    ELSE seq_num::text
  END;
$$;

COMMENT ON FUNCTION public.format_business_code IS 'Formats business codes with minimum 2-digit zero padding without string truncation.';

-- 2. Generic Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.prevent_business_code_column_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  col_name text := TG_ARGV[0];
  old_val text;
  new_val text;
BEGIN
  EXECUTE format('SELECT ($1).%I, ($2).%I', col_name, col_name) USING OLD, NEW INTO old_val, new_val;
  IF old_val IS NOT NULL AND new_val IS DISTINCT FROM old_val THEN
    RAISE EXCEPTION 'Business code column % is immutable and cannot be updated once set (current: %, attempted: %).', col_name, old_val, new_val;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_business_code_column_update IS 'Enforces database-level immutability for business codes once assigned.';

-- 3. Sequences for All Business Entities
CREATE SEQUENCE IF NOT EXISTS public.profiles_account_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.employee_profiles_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.client_companies_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.departments_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.teams_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.services_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.projects_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.tasks_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.contracts_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.invoices_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.invoice_payments_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.leave_requests_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.attendance_records_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.account_approval_events_code_seq START WITH 1;

-- 4. Add Business Code Columns

-- A. Accounts / Profiles (TK_01)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_code TEXT UNIQUE;
COMMENT ON COLUMN public.profiles.account_code IS 'Human-readable business identifier for account/profile (TK_01). Technical PK remains id (UUID).';

-- B. Employee Profiles (NV_01)
COMMENT ON COLUMN public.employee_profiles.employee_code IS 'Human-readable business identifier for employee (NV_01). Technical PK remains user_id (UUID).';

-- C. Client Companies (KH_01)
ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS client_code TEXT UNIQUE;
COMMENT ON COLUMN public.client_companies.client_code IS 'Human-readable business identifier for client company (KH_01). Technical PK remains id (UUID).';

-- D. Departments (PB_01)
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_code TEXT UNIQUE;
COMMENT ON COLUMN public.departments.department_code IS 'Human-readable business identifier for department (PB_01). Technical PK remains id (UUID).';

-- E. Teams (N_01)
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS team_code TEXT UNIQUE;
COMMENT ON COLUMN public.teams.team_code IS 'Human-readable business identifier for team (N_01). Technical PK remains id (UUID).';

-- F. Services (DV_01)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_code TEXT UNIQUE;
COMMENT ON COLUMN public.services.service_code IS 'Human-readable business identifier for service catalog (DV_01). Technical PK remains id (UUID).';

-- G. Projects (DA_01)
COMMENT ON COLUMN public.projects.project_code IS 'Human-readable business identifier for project (DA_01). Technical PK remains id (UUID).';

-- H. Tasks (CV_01)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_code TEXT UNIQUE;
COMMENT ON COLUMN public.tasks.task_code IS 'Human-readable business identifier for project task (CV_01). Technical PK remains id (UUID).';

-- I. Contracts (HD_01)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_code TEXT UNIQUE;
COMMENT ON COLUMN public.contracts.contract_code IS 'Human-readable business identifier for contract (HD_01). Technical PK remains id (UUID).';

-- J. Invoices (HDON_01)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_code TEXT UNIQUE;
COMMENT ON COLUMN public.invoices.invoice_code IS 'Human-readable business identifier for invoice (HDON_01). Technical PK remains id (UUID).';

-- K. Invoice Payments (TT_01)
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS payment_code TEXT UNIQUE;
COMMENT ON COLUMN public.invoice_payments.payment_code IS 'Human-readable business identifier for payment (TT_01). Technical PK remains id (UUID).';

-- L. Leave Requests (NP_01)
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_code TEXT UNIQUE;
COMMENT ON COLUMN public.leave_requests.leave_code IS 'Human-readable business identifier for leave request (NP_01). Technical PK remains id (UUID).';

-- M. Attendance Records (CC_01)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS attendance_code TEXT UNIQUE;
COMMENT ON COLUMN public.attendance_records.attendance_code IS 'Human-readable business identifier for attendance record (CC_01). Technical PK remains id (UUID).';

-- N. Account Approval Events (DTK_01)
ALTER TABLE public.account_approval_events
  ADD COLUMN IF NOT EXISTS approval_event_code TEXT UNIQUE;
COMMENT ON COLUMN public.account_approval_events.approval_event_code IS 'Human-readable business identifier for approval event (DTK_01). Technical PK remains id (UUID).';

-- 5. Deterministic Collision-Proof Backfill Before Enabling Constraints

-- Backfill Profiles (TK_01, TK_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(account_code, '^TK_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.profiles
  WHERE account_code ~ '^TK_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.profiles
    WHERE account_code IS NULL OR account_code !~ '^TK_[0-9]{2,}$'
  )
  UPDATE public.profiles p
  SET account_code = public.format_business_code('TK', n.rn)
  FROM numbered n
  WHERE p.id = n.id;

  PERFORM setval(
    'public.profiles_account_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(account_code, '^TK_', ''), '')::bigint), 0) FROM public.profiles),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Client Companies (KH_01, KH_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(client_code, '^KH_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.client_companies
  WHERE client_code ~ '^KH_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.client_companies
    WHERE client_code IS NULL OR client_code !~ '^KH_[0-9]{2,}$'
  )
  UPDATE public.client_companies c
  SET client_code = public.format_business_code('KH', n.rn)
  FROM numbered n
  WHERE c.id = n.id;

  PERFORM setval(
    'public.client_companies_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(client_code, '^KH_', ''), '')::bigint), 0) FROM public.client_companies),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Employee Profiles (NV_01, NV_02...) - Collision Safe
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '^NV_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.employee_profiles
  WHERE employee_code ~ '^NV_[0-9]+$';

  WITH numbered AS (
    SELECT user_id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, user_id ASC) + max_num) AS rn
    FROM public.employee_profiles
    WHERE employee_code IS NULL OR employee_code !~ '^NV_[0-9]{2,}$'
  )
  UPDATE public.employee_profiles ep
  SET employee_code = public.format_business_code('NV', n.rn)
  FROM numbered n
  WHERE ep.user_id = n.user_id;

  PERFORM setval(
    'public.employee_profiles_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '^NV_', ''), '')::bigint), 0) FROM public.employee_profiles),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Departments (PB_01, PB_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(department_code, '^PB_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.departments
  WHERE department_code ~ '^PB_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.departments
    WHERE department_code IS NULL OR department_code !~ '^PB_[0-9]{2,}$'
  )
  UPDATE public.departments d
  SET department_code = public.format_business_code('PB', n.rn)
  FROM numbered n
  WHERE d.id = n.id;

  PERFORM setval(
    'public.departments_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(department_code, '^PB_', ''), '')::bigint), 0) FROM public.departments),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Teams (N_01, N_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(team_code, '^N_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.teams
  WHERE team_code ~ '^N_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.teams
    WHERE team_code IS NULL OR team_code !~ '^N_[0-9]{2,}$'
  )
  UPDATE public.teams t
  SET team_code = public.format_business_code('N', n.rn)
  FROM numbered n
  WHERE t.id = n.id;

  PERFORM setval(
    'public.teams_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(team_code, '^N_', ''), '')::bigint), 0) FROM public.teams),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Services (DV_01, DV_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(service_code, '^DV_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.services
  WHERE service_code ~ '^DV_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.services
    WHERE service_code IS NULL OR service_code !~ '^DV_[0-9]{2,}$'
  )
  UPDATE public.services s
  SET service_code = public.format_business_code('DV', n.rn)
  FROM numbered n
  WHERE s.id = n.id;

  PERFORM setval(
    'public.services_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(service_code, '^DV_', ''), '')::bigint), 0) FROM public.services),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Projects (DA_01, DA_02...) - Collision Safe
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(project_code, '^DA_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.projects
  WHERE project_code ~ '^DA_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.projects
    WHERE project_code IS NULL OR project_code !~ '^DA_[0-9]{2,}$'
  )
  UPDATE public.projects p
  SET project_code = public.format_business_code('DA', n.rn)
  FROM numbered n
  WHERE p.id = n.id;

  PERFORM setval(
    'public.projects_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(project_code, '^DA_', ''), '')::bigint), 0) FROM public.projects),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Tasks (CV_01, CV_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(task_code, '^CV_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.tasks
  WHERE task_code ~ '^CV_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.tasks
    WHERE task_code IS NULL OR task_code !~ '^CV_[0-9]{2,}$'
  )
  UPDATE public.tasks t
  SET task_code = public.format_business_code('CV', n.rn)
  FROM numbered n
  WHERE t.id = n.id;

  PERFORM setval(
    'public.tasks_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(task_code, '^CV_', ''), '')::bigint), 0) FROM public.tasks),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Contracts (HD_01, HD_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(contract_code, '^HD_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.contracts
  WHERE contract_code ~ '^HD_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.contracts
    WHERE contract_code IS NULL OR contract_code !~ '^HD_[0-9]{2,}$'
  )
  UPDATE public.contracts c
  SET contract_code = public.format_business_code('HD', n.rn)
  FROM numbered n
  WHERE c.id = n.id;

  PERFORM setval(
    'public.contracts_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(contract_code, '^HD_', ''), '')::bigint), 0) FROM public.contracts),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Invoices (HDON_01, HDON_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_code, '^HDON_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.invoices
  WHERE invoice_code ~ '^HDON_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.invoices
    WHERE invoice_code IS NULL OR invoice_code !~ '^HDON_[0-9]{2,}$'
  )
  UPDATE public.invoices i
  SET invoice_code = public.format_business_code('HDON', n.rn)
  FROM numbered n
  WHERE i.id = n.id;

  PERFORM setval(
    'public.invoices_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_code, '^HDON_', ''), '')::bigint), 0) FROM public.invoices),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Invoice Payments (TT_01, TT_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(payment_code, '^TT_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.invoice_payments
  WHERE payment_code ~ '^TT_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.invoice_payments
    WHERE payment_code IS NULL OR payment_code !~ '^TT_[0-9]{2,}$'
  )
  UPDATE public.invoice_payments ip
  SET payment_code = public.format_business_code('TT', n.rn)
  FROM numbered n
  WHERE ip.id = n.id;

  PERFORM setval(
    'public.invoice_payments_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(payment_code, '^TT_', ''), '')::bigint), 0) FROM public.invoice_payments),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Leave Requests (NP_01, NP_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(leave_code, '^NP_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.leave_requests
  WHERE leave_code ~ '^NP_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.leave_requests
    WHERE leave_code IS NULL OR leave_code !~ '^NP_[0-9]{2,}$'
  )
  UPDATE public.leave_requests lr
  SET leave_code = public.format_business_code('NP', n.rn)
  FROM numbered n
  WHERE lr.id = n.id;

  PERFORM setval(
    'public.leave_requests_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(leave_code, '^NP_', ''), '')::bigint), 0) FROM public.leave_requests),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Attendance Records (CC_01, CC_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(attendance_code, '^CC_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.attendance_records
  WHERE attendance_code ~ '^CC_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.attendance_records
    WHERE attendance_code IS NULL OR attendance_code !~ '^CC_[0-9]{2,}$'
  )
  UPDATE public.attendance_records ar
  SET attendance_code = public.format_business_code('CC', n.rn)
  FROM numbered n
  WHERE ar.id = n.id;

  PERFORM setval(
    'public.attendance_records_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(attendance_code, '^CC_', ''), '')::bigint), 0) FROM public.attendance_records),
      1
    ) + 1,
    false
  );
END $$;

-- Backfill Account Approval Events (DTK_01, DTK_02...)
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(approval_event_code, '^DTK_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.account_approval_events
  WHERE approval_event_code ~ '^DTK_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.account_approval_events
    WHERE approval_event_code IS NULL OR approval_event_code !~ '^DTK_[0-9]{2,}$'
  )
  UPDATE public.account_approval_events aae
  SET approval_event_code = public.format_business_code('DTK', n.rn)
  FROM numbered n
  WHERE aae.id = n.id;

  PERFORM setval(
    'public.account_approval_events_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(approval_event_code, '^DTK_', ''), '')::bigint), 0) FROM public.account_approval_events),
      1
    ) + 1,
    false
  );
END $$;

-- 6. Enforce Business Code Format via CHECK Constraints
ALTER TABLE public.profiles
  ADD CONSTRAINT check_profiles_account_code_format CHECK (account_code IS NULL OR account_code ~ '^TK_[0-9]{2,}$');

ALTER TABLE public.employee_profiles
  ADD CONSTRAINT check_employee_code_format CHECK (employee_code IS NULL OR employee_code ~ '^NV_[0-9]{2,}$');

ALTER TABLE public.client_companies
  ADD CONSTRAINT check_client_code_format CHECK (client_code IS NULL OR client_code ~ '^KH_[0-9]{2,}$');

ALTER TABLE public.departments
  ADD CONSTRAINT check_department_code_format CHECK (department_code IS NULL OR department_code ~ '^PB_[0-9]{2,}$');

ALTER TABLE public.teams
  ADD CONSTRAINT check_team_code_format CHECK (team_code IS NULL OR team_code ~ '^N_[0-9]{2,}$');

ALTER TABLE public.services
  ADD CONSTRAINT check_service_code_format CHECK (service_code IS NULL OR service_code ~ '^DV_[0-9]{2,}$');

ALTER TABLE public.projects
  ADD CONSTRAINT check_project_code_format CHECK (project_code IS NULL OR project_code ~ '^DA_[0-9]{2,}$');

ALTER TABLE public.tasks
  ADD CONSTRAINT check_task_code_format CHECK (task_code IS NULL OR task_code ~ '^CV_[0-9]{2,}$');

ALTER TABLE public.contracts
  ADD CONSTRAINT check_contract_code_format CHECK (contract_code IS NULL OR contract_code ~ '^HD_[0-9]{2,}$');

ALTER TABLE public.invoices
  ADD CONSTRAINT check_invoice_code_format CHECK (invoice_code IS NULL OR invoice_code ~ '^HDON_[0-9]{2,}$');

ALTER TABLE public.invoice_payments
  ADD CONSTRAINT check_payment_code_format CHECK (payment_code IS NULL OR payment_code ~ '^TT_[0-9]{2,}$');

ALTER TABLE public.leave_requests
  ADD CONSTRAINT check_leave_code_format CHECK (leave_code IS NULL OR leave_code ~ '^NP_[0-9]{2,}$');

ALTER TABLE public.attendance_records
  ADD CONSTRAINT check_attendance_code_format CHECK (attendance_code IS NULL OR attendance_code ~ '^CC_[0-9]{2,}$');

ALTER TABLE public.account_approval_events
  ADD CONSTRAINT check_approval_event_code_format CHECK (approval_event_code IS NULL OR approval_event_code ~ '^DTK_[0-9]{2,}$');

-- 7. Auto-Generation Triggers (BEFORE INSERT)

-- A. Profiles Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_profile_account_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.account_code IS NULL OR btrim(NEW.account_code) = '' THEN
    NEW.account_code := public.format_business_code('TK', nextval('public.profiles_account_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_profile_account_code ON public.profiles;
CREATE TRIGGER trg_set_profile_account_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_profile_account_code();

-- B. Employee Profiles Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_employee_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_code IS NULL OR btrim(NEW.employee_code) = '' THEN
    NEW.employee_code := public.format_business_code('NV', nextval('public.employee_profiles_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_employee_code ON public.employee_profiles;
CREATE TRIGGER trg_set_employee_code
  BEFORE INSERT ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_employee_code();

-- C. Client Companies Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_client_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_code IS NULL OR btrim(NEW.client_code) = '' THEN
    NEW.client_code := public.format_business_code('KH', nextval('public.client_companies_code_seq'));
  END IF;
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := NEW.client_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_code ON public.client_companies;
CREATE TRIGGER trg_set_client_code
  BEFORE INSERT ON public.client_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_client_code();

-- D. Departments Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_department_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.department_code IS NULL OR btrim(NEW.department_code) = '' THEN
    NEW.department_code := public.format_business_code('PB', nextval('public.departments_code_seq'));
  END IF;
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := NEW.department_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_department_code ON public.departments;
CREATE TRIGGER trg_set_department_code
  BEFORE INSERT ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_department_code();

-- E. Teams Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_team_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team_code IS NULL OR btrim(NEW.team_code) = '' THEN
    NEW.team_code := public.format_business_code('N', nextval('public.teams_code_seq'));
  END IF;
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := NEW.team_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_team_code ON public.teams;
CREATE TRIGGER trg_set_team_code
  BEFORE INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_team_code();

-- F. Services Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_service_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.service_code IS NULL OR btrim(NEW.service_code) = '' THEN
    NEW.service_code := public.format_business_code('DV', nextval('public.services_code_seq'));
  END IF;
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := NEW.service_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_service_code ON public.services;
CREATE TRIGGER trg_set_service_code
  BEFORE INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_service_code();

-- G. Projects Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_code IS NULL OR btrim(NEW.project_code) = '' THEN
    NEW.project_code := public.format_business_code('DA', nextval('public.projects_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_code ON public.projects;
CREATE TRIGGER trg_set_project_code
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_project_code();

-- H. Tasks Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_task_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.task_code IS NULL OR btrim(NEW.task_code) = '' THEN
    NEW.task_code := public.format_business_code('CV', nextval('public.tasks_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_code ON public.tasks;
CREATE TRIGGER trg_set_task_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_task_code();

-- I. Contracts Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_contract_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contract_code IS NULL OR btrim(NEW.contract_code) = '' THEN
    NEW.contract_code := public.format_business_code('HD', nextval('public.contracts_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_code ON public.contracts;
CREATE TRIGGER trg_set_contract_code
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_contract_code();

-- J. Invoices Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_invoice_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_code IS NULL OR btrim(NEW.invoice_code) = '' THEN
    NEW.invoice_code := public.format_business_code('HDON', nextval('public.invoices_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_code ON public.invoices;
CREATE TRIGGER trg_set_invoice_code
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_invoice_code();

-- K. Invoice Payments Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_payment_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_code IS NULL OR btrim(NEW.payment_code) = '' THEN
    NEW.payment_code := public.format_business_code('TT', nextval('public.invoice_payments_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payment_code ON public.invoice_payments;
CREATE TRIGGER trg_set_payment_code
  BEFORE INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_payment_code();

-- L. Leave Requests Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_leave_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.leave_code IS NULL OR btrim(NEW.leave_code) = '' THEN
    NEW.leave_code := public.format_business_code('NP', nextval('public.leave_requests_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_leave_code ON public.leave_requests;
CREATE TRIGGER trg_set_leave_code
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_leave_code();

-- M. Attendance Records Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_attendance_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attendance_code IS NULL OR btrim(NEW.attendance_code) = '' THEN
    NEW.attendance_code := public.format_business_code('CC', nextval('public.attendance_records_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_attendance_code ON public.attendance_records;
CREATE TRIGGER trg_set_attendance_code
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_attendance_code();

-- N. Account Approval Events Trigger
CREATE OR REPLACE FUNCTION public.trigger_set_approval_event_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approval_event_code IS NULL OR btrim(NEW.approval_event_code) = '' THEN
    NEW.approval_event_code := public.format_business_code('DTK', nextval('public.account_approval_events_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_approval_event_code ON public.account_approval_events;
CREATE TRIGGER trg_set_approval_event_code
  BEFORE INSERT ON public.account_approval_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_approval_event_code();

-- 8. Immutability Triggers (BEFORE UPDATE)

DROP TRIGGER IF EXISTS trg_immutable_profiles_account_code ON public.profiles;
CREATE TRIGGER trg_immutable_profiles_account_code
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('account_code');

DROP TRIGGER IF EXISTS trg_immutable_employee_code ON public.employee_profiles;
CREATE TRIGGER trg_immutable_employee_code
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('employee_code');

DROP TRIGGER IF EXISTS trg_immutable_client_code ON public.client_companies;
CREATE TRIGGER trg_immutable_client_code
  BEFORE UPDATE ON public.client_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('client_code');

DROP TRIGGER IF EXISTS trg_immutable_department_code ON public.departments;
CREATE TRIGGER trg_immutable_department_code
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('department_code');

DROP TRIGGER IF EXISTS trg_immutable_team_code ON public.teams;
CREATE TRIGGER trg_immutable_team_code
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('team_code');

DROP TRIGGER IF EXISTS trg_immutable_service_code ON public.services;
CREATE TRIGGER trg_immutable_service_code
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('service_code');

DROP TRIGGER IF EXISTS trg_immutable_project_code ON public.projects;
CREATE TRIGGER trg_immutable_project_code
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('project_code');

DROP TRIGGER IF EXISTS trg_immutable_task_code ON public.tasks;
CREATE TRIGGER trg_immutable_task_code
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('task_code');

DROP TRIGGER IF EXISTS trg_immutable_contract_code ON public.contracts;
CREATE TRIGGER trg_immutable_contract_code
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('contract_code');

DROP TRIGGER IF EXISTS trg_immutable_invoice_code ON public.invoices;
CREATE TRIGGER trg_immutable_invoice_code
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('invoice_code');

DROP TRIGGER IF EXISTS trg_immutable_payment_code ON public.invoice_payments;
CREATE TRIGGER trg_immutable_payment_code
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('payment_code');

DROP TRIGGER IF EXISTS trg_immutable_leave_code ON public.leave_requests;
CREATE TRIGGER trg_immutable_leave_code
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('leave_code');

DROP TRIGGER IF EXISTS trg_immutable_attendance_code ON public.attendance_records;
CREATE TRIGGER trg_immutable_attendance_code
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('attendance_code');

DROP TRIGGER IF EXISTS trg_immutable_approval_event_code ON public.account_approval_events;
CREATE TRIGGER trg_immutable_approval_event_code
  BEFORE UPDATE ON public.account_approval_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('approval_event_code');
