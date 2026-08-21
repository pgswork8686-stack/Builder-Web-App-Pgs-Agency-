-- ============================================================
-- Migration: Harden Payroll Run Integrity & Atomic State Transitions
-- Timestamp: 20260821082316_harden_payroll_run_integrity.sql
-- ============================================================

-- 1. Uniqueness guard on payroll_runs period_month
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS uq_payroll_runs_period_month;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT uq_payroll_runs_period_month UNIQUE (period_month);

-- 2. Atomic state transition: approve_payroll_run
CREATE OR REPLACE FUNCTION public.approve_payroll_run(
  p_run_id UUID,
  p_approved_by UUID
)
RETURNS public.payroll_runs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.payroll_runs;
BEGIN
  -- Lock payroll run row
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_RUN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_run.status = 'approved' THEN
    RAISE EXCEPTION 'PAYROLL_ALREADY_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  IF v_run.status = 'paid' THEN
    RAISE EXCEPTION 'PAYROLL_ALREADY_PAID' USING ERRCODE = 'P0001';
  END IF;

  IF v_run.status NOT IN ('draft', 'calculated') THEN
    RAISE EXCEPTION 'PAYROLL_INVALID_STATE_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'approved',
      approved_by_user_id = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_run_id
  RETURNING * INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payroll_run(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payroll_run(UUID, UUID) TO service_role;

-- 3. Atomic state transition: mark_payroll_run_paid
CREATE OR REPLACE FUNCTION public.mark_payroll_run_paid(
  p_run_id UUID
)
RETURNS public.payroll_runs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.payroll_runs;
BEGIN
  -- Lock payroll run row
  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYROLL_RUN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_run.status = 'paid' THEN
    RAISE EXCEPTION 'PAYROLL_ALREADY_PAID' USING ERRCODE = 'P0001';
  END IF;

  IF v_run.status != 'approved' THEN
    RAISE EXCEPTION 'PAYROLL_NOT_APPROVED' USING ERRCODE = 'P0001';
  END IF;

  -- Atomically mark all associated payslips as paid
  UPDATE public.payslips
  SET payment_status = 'paid',
      updated_at = now()
  WHERE payroll_run_id = p_run_id;

  -- Atomically mark the payroll run as paid
  UPDATE public.payroll_runs
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_run_id
  RETURNING * INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payroll_run_paid(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payroll_run_paid(UUID) TO service_role;
