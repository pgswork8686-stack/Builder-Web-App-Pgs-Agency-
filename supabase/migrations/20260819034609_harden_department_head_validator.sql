-- ============================================================
-- Migration: Harden Department Head Validator Trigger
-- Timestamp: 20260819034609_harden_department_head_validator.sql
-- Description:
--   1. Validates that assigned head_user_id belongs to an active internal account.
--   2. Enforces that client users, inactive accounts, or non-existent accounts cannot be appointed as department head.
--   3. Hardened with SECURITY DEFINER, SET search_path = '', and execution permissions revoked from public/anon/authenticated.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_department_head_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_role public.app_role;
  target_status public.account_status;
BEGIN
  IF NEW.head_user_id IS NOT NULL THEN
    SELECT p.role, p.account_status
    INTO target_role, target_status
    FROM public.profiles p
    WHERE p.id = NEW.head_user_id;

    IF target_role IS NULL THEN
      RAISE EXCEPTION 'Department head user does not exist.'
        USING ERRCODE = 'P2001';
    END IF;

    IF target_role = 'client'::public.app_role THEN
      RAISE EXCEPTION 'Client account cannot be assigned as department head.'
        USING ERRCODE = 'P2002';
    END IF;

    IF target_status <> 'active'::public.account_status THEN
      RAISE EXCEPTION 'Only active internal accounts can be assigned as department head (current status: %).', target_status
        USING ERRCODE = 'P2003';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_department_head_assignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_departments_validate_head ON public.departments;
CREATE TRIGGER trg_departments_validate_head
  BEFORE INSERT OR UPDATE OF head_user_id ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_department_head_assignment();
