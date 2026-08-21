-- ============================================================
-- Migration: Fix Admin View Service Role Privileges (Strict SELECT Only)
-- Timestamp: 20260818171000_fix_admin_view_service_role_privileges.sql
-- Description:
--   Explicitly REVOKE ALL PRIVILEGES on all 13 admin_* views from service_role,
--   anon, authenticated, and PUBLIC, then GRANT SELECT ONLY to service_role.
--   Enforces strict verification inside transaction:
--   1. service_role has ONLY SELECT privilege (count = 13)
--   2. anon and authenticated have 0 privileges
-- ============================================================

-- 1. admin_account_approval_events
REVOKE ALL PRIVILEGES ON public.admin_account_approval_events FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_account_approval_events TO service_role;

-- 2. admin_attendance_records
REVOKE ALL PRIVILEGES ON public.admin_attendance_records FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_attendance_records TO service_role;

-- 3. admin_clients
REVOKE ALL PRIVILEGES ON public.admin_clients FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_clients TO service_role;

-- 4. admin_contracts
REVOKE ALL PRIVILEGES ON public.admin_contracts FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_contracts TO service_role;

-- 5. admin_departments
REVOKE ALL PRIVILEGES ON public.admin_departments FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_departments TO service_role;

-- 6. admin_invoices
REVOKE ALL PRIVILEGES ON public.admin_invoices FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_invoices TO service_role;

-- 7. admin_leave_requests
REVOKE ALL PRIVILEGES ON public.admin_leave_requests FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_leave_requests TO service_role;

-- 8. admin_payments
REVOKE ALL PRIVILEGES ON public.admin_payments FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_payments TO service_role;

-- 9. admin_people
REVOKE ALL PRIVILEGES ON public.admin_people FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_people TO service_role;

-- 10. admin_projects
REVOKE ALL PRIVILEGES ON public.admin_projects FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_projects TO service_role;

-- 11. admin_services
REVOKE ALL PRIVILEGES ON public.admin_services FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_services TO service_role;

-- 12. admin_tasks
REVOKE ALL PRIVILEGES ON public.admin_tasks FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_tasks TO service_role;

-- 13. admin_teams
REVOKE ALL PRIVILEGES ON public.admin_teams FROM service_role, anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_teams TO service_role;

-- ============================================================
-- VERIFICATION BLOCK: Strict Privilege Enforcement
-- ============================================================
DO $$
DECLARE
  v_non_select_sr_count integer;
  v_select_sr_count     integer;
  v_anon_auth_count     integer;
BEGIN
  -- 1. Check service_role non-SELECT privileges (MUST BE 0)
  SELECT COUNT(*) INTO v_non_select_sr_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name LIKE 'admin\_%' ESCAPE '\'
    AND grantee = 'service_role'
    AND privilege_type != 'SELECT';

  IF v_non_select_sr_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role has % non-SELECT privileges on admin_* views!', v_non_select_sr_count;
  END IF;

  -- 2. Check service_role SELECT count (MUST BE EXACTLY 13)
  SELECT COUNT(*) INTO v_select_sr_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name LIKE 'admin\_%' ESCAPE '\'
    AND grantee = 'service_role'
    AND privilege_type = 'SELECT';

  IF v_select_sr_count != 13 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: service_role has % SELECT grants on admin_* views (expected exactly 13)!', v_select_sr_count;
  END IF;

  -- 3. Check anon & authenticated privileges (MUST BE 0)
  SELECT COUNT(*) INTO v_anon_auth_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name LIKE 'admin\_%' ESCAPE '\'
    AND grantee IN ('anon', 'authenticated');

  IF v_anon_auth_count > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: anon or authenticated has % privileges on admin_* views (expected 0)!', v_anon_auth_count;
  END IF;

  RAISE NOTICE 'Strict admin view privilege verification: ALL CHECKS PASSED. service_role has SELECT ONLY (13 views), anon/auth = 0.';
END $$;
