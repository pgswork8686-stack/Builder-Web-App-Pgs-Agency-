-- ============================================================
-- Migration: Harden Business Code Functions & Fix Admin View Privileges
-- Timestamp: 20260818170000_harden_business_code_security.sql
-- Description:
--   1. Re-create all 16 business-code functions with SET search_path = ''
--      to eliminate function_search_path_mutable Security Advisor warnings.
--      All PostgreSQL built-ins are fully schema-qualified (pg_catalog.*).
--      All project objects are fully schema-qualified (public.*).
--   2. Revoke ALL excessive privileges on all 13 admin_* views.
--      Grant SELECT ONLY to service_role (Supabase backend / Table Editor).
--      anon and authenticated get NO access to admin views.
-- NOTE: This migration does NOT modify previously applied migrations
--       20260818160000 or 20260818161000.
-- ============================================================

-- ============================================================
-- PART 1: HARDEN FUNCTION search_path
-- Addresses Supabase Security Advisor: function_search_path_mutable
-- All 16 affected functions are re-created with SET search_path = ''
-- ============================================================

-- 1A. format_business_code (SQL IMMUTABLE helper)
CREATE OR REPLACE FUNCTION public.format_business_code(prefix text, seq_num bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT prefix || '_' || CASE
    WHEN seq_num < 10 THEN '0' || seq_num::text
    ELSE seq_num::text
  END;
$$;

-- 1B. prevent_business_code_column_update (generic immutability trigger)
CREATE OR REPLACE FUNCTION public.prevent_business_code_column_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  col_name text := TG_ARGV[0];
  old_val  text;
  new_val  text;
BEGIN
  EXECUTE pg_catalog.format('SELECT ($1).%I, ($2).%I', col_name, col_name)
    USING OLD, NEW
    INTO old_val, new_val;
  IF old_val IS NOT NULL AND new_val IS DISTINCT FROM old_val THEN
    RAISE EXCEPTION
      'Business code column % is immutable and cannot be updated once set (current: %, attempted: %).',
      col_name, old_val, new_val;
  END IF;
  RETURN NEW;
END;
$$;

-- 1C. trigger_set_profile_account_code
CREATE OR REPLACE FUNCTION public.trigger_set_profile_account_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_code IS NULL OR pg_catalog.btrim(NEW.account_code) = '' THEN
    NEW.account_code := public.format_business_code('TK', pg_catalog.nextval('public.profiles_account_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1D. trigger_set_employee_code
CREATE OR REPLACE FUNCTION public.trigger_set_employee_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.employee_code IS NULL OR pg_catalog.btrim(NEW.employee_code) = '' THEN
    NEW.employee_code := public.format_business_code('NV', pg_catalog.nextval('public.employee_profiles_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1E. trigger_set_client_code
CREATE OR REPLACE FUNCTION public.trigger_set_client_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_code IS NULL OR pg_catalog.btrim(NEW.client_code) = '' THEN
    NEW.client_code := public.format_business_code('KH', pg_catalog.nextval('public.client_companies_code_seq'));
  END IF;
  IF NEW.code IS NULL OR pg_catalog.btrim(NEW.code) = '' THEN
    NEW.code := NEW.client_code;
  END IF;
  RETURN NEW;
END;
$$;

-- 1F. trigger_set_department_code
CREATE OR REPLACE FUNCTION public.trigger_set_department_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.department_code IS NULL OR pg_catalog.btrim(NEW.department_code) = '' THEN
    NEW.department_code := public.format_business_code('PB', pg_catalog.nextval('public.departments_code_seq'));
  END IF;
  IF NEW.code IS NULL OR pg_catalog.btrim(NEW.code) = '' THEN
    NEW.code := NEW.department_code;
  END IF;
  RETURN NEW;
END;
$$;

-- 1G. trigger_set_team_code
CREATE OR REPLACE FUNCTION public.trigger_set_team_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.team_code IS NULL OR pg_catalog.btrim(NEW.team_code) = '' THEN
    NEW.team_code := public.format_business_code('N', pg_catalog.nextval('public.teams_code_seq'));
  END IF;
  IF NEW.code IS NULL OR pg_catalog.btrim(NEW.code) = '' THEN
    NEW.code := NEW.team_code;
  END IF;
  RETURN NEW;
END;
$$;

-- 1H. trigger_set_service_code
CREATE OR REPLACE FUNCTION public.trigger_set_service_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_code IS NULL OR pg_catalog.btrim(NEW.service_code) = '' THEN
    NEW.service_code := public.format_business_code('DV', pg_catalog.nextval('public.services_code_seq'));
  END IF;
  IF NEW.code IS NULL OR pg_catalog.btrim(NEW.code) = '' THEN
    NEW.code := NEW.service_code;
  END IF;
  RETURN NEW;
END;
$$;

-- 1I. trigger_set_project_code
CREATE OR REPLACE FUNCTION public.trigger_set_project_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_code IS NULL OR pg_catalog.btrim(NEW.project_code) = '' THEN
    NEW.project_code := public.format_business_code('DA', pg_catalog.nextval('public.projects_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1J. trigger_set_task_code
CREATE OR REPLACE FUNCTION public.trigger_set_task_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.task_code IS NULL OR pg_catalog.btrim(NEW.task_code) = '' THEN
    NEW.task_code := public.format_business_code('CV', pg_catalog.nextval('public.tasks_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1K. trigger_set_contract_code
CREATE OR REPLACE FUNCTION public.trigger_set_contract_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.contract_code IS NULL OR pg_catalog.btrim(NEW.contract_code) = '' THEN
    NEW.contract_code := public.format_business_code('HD', pg_catalog.nextval('public.contracts_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1L. trigger_set_invoice_code
CREATE OR REPLACE FUNCTION public.trigger_set_invoice_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.invoice_code IS NULL OR pg_catalog.btrim(NEW.invoice_code) = '' THEN
    NEW.invoice_code := public.format_business_code('HDON', pg_catalog.nextval('public.invoices_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1M. trigger_set_payment_code
CREATE OR REPLACE FUNCTION public.trigger_set_payment_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_code IS NULL OR pg_catalog.btrim(NEW.payment_code) = '' THEN
    NEW.payment_code := public.format_business_code('TT', pg_catalog.nextval('public.invoice_payments_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1N. trigger_set_leave_code
CREATE OR REPLACE FUNCTION public.trigger_set_leave_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.leave_code IS NULL OR pg_catalog.btrim(NEW.leave_code) = '' THEN
    NEW.leave_code := public.format_business_code('NP', pg_catalog.nextval('public.leave_requests_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1O. trigger_set_attendance_code
CREATE OR REPLACE FUNCTION public.trigger_set_attendance_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.attendance_code IS NULL OR pg_catalog.btrim(NEW.attendance_code) = '' THEN
    NEW.attendance_code := public.format_business_code('CC', pg_catalog.nextval('public.attendance_records_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- 1P. trigger_set_approval_event_code
CREATE OR REPLACE FUNCTION public.trigger_set_approval_event_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.approval_event_code IS NULL OR pg_catalog.btrim(NEW.approval_event_code) = '' THEN
    NEW.approval_event_code := public.format_business_code('DTK', pg_catalog.nextval('public.account_approval_events_code_seq'));
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PART 2: HARDEN ADMIN VIEW PRIVILEGES
-- Revoke all excess privileges; grant SELECT-only to service_role.
-- anon and authenticated get ZERO access to admin views.
-- Supabase Table Editor (service_role) retains SELECT for administration.
-- ============================================================

-- admin_account_approval_events
REVOKE ALL PRIVILEGES ON public.admin_account_approval_events FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_account_approval_events TO service_role;

-- admin_clients
REVOKE ALL PRIVILEGES ON public.admin_clients FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_clients TO service_role;

-- admin_people
REVOKE ALL PRIVILEGES ON public.admin_people FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_people TO service_role;

-- admin_departments
REVOKE ALL PRIVILEGES ON public.admin_departments FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_departments TO service_role;

-- admin_teams
REVOKE ALL PRIVILEGES ON public.admin_teams FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_teams TO service_role;

-- admin_projects
REVOKE ALL PRIVILEGES ON public.admin_projects FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_projects TO service_role;

-- admin_tasks
REVOKE ALL PRIVILEGES ON public.admin_tasks FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_tasks TO service_role;

-- admin_attendance_records
REVOKE ALL PRIVILEGES ON public.admin_attendance_records FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_attendance_records TO service_role;

-- admin_leave_requests
REVOKE ALL PRIVILEGES ON public.admin_leave_requests FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_leave_requests TO service_role;

-- admin_contracts
REVOKE ALL PRIVILEGES ON public.admin_contracts FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_contracts TO service_role;

-- admin_invoices
REVOKE ALL PRIVILEGES ON public.admin_invoices FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_invoices TO service_role;

-- admin_payments
REVOKE ALL PRIVILEGES ON public.admin_payments FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_payments TO service_role;

-- admin_services
REVOKE ALL PRIVILEGES ON public.admin_services FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_services TO service_role;

-- ============================================================
-- PART 3: VERIFICATION QUERY (informational, runs at migration time)
-- ============================================================
DO $$
DECLARE
  bad_grants integer;
  bad_funcs  integer;
BEGIN
  -- Check no INSERT/UPDATE/DELETE/TRUNCATE remains on admin views for anon/authenticated
  SELECT COUNT(*) INTO bad_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name LIKE 'admin_%'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES');

  IF bad_grants > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: % excess privileges remain on admin views for anon/authenticated!', bad_grants;
  END IF;

  RAISE NOTICE 'Admin view privilege hardening: VERIFIED (0 excess grants for anon/authenticated).';

  -- Check functions now have non-null config (search_path locked)
  SELECT COUNT(*) INTO bad_funcs
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'format_business_code',
      'prevent_business_code_column_update',
      'trigger_set_profile_account_code',
      'trigger_set_employee_code',
      'trigger_set_client_code',
      'trigger_set_department_code',
      'trigger_set_team_code',
      'trigger_set_service_code',
      'trigger_set_project_code',
      'trigger_set_task_code',
      'trigger_set_contract_code',
      'trigger_set_invoice_code',
      'trigger_set_payment_code',
      'trigger_set_leave_code',
      'trigger_set_attendance_code',
      'trigger_set_approval_event_code'
    )
    AND (p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
    ));

  IF bad_funcs > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: % business-code functions still have mutable search_path!', bad_funcs;
  END IF;

  RAISE NOTICE 'Function search_path hardening: VERIFIED (all 16 business-code functions have fixed search_path).';
END $$;
