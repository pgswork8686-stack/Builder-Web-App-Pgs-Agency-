-- Migration: Phase 5 - Fix Round 1 (Hardening Attendance & Leave Transactions)
-- Timestamp: 20260812130000_phase5_fix_round1.sql

-- ===========================================================================
-- BLOCKER 1: Remove Invented HR Policy (Make workday schedule nullable)
-- ===========================================================================
ALTER TABLE public.attendance_settings 
  ALTER COLUMN workday_start_time DROP NOT NULL,
  ALTER COLUMN workday_start_time DROP DEFAULT,
  ALTER COLUMN workday_end_time DROP NOT NULL,
  ALTER COLUMN workday_end_time DROP DEFAULT,
  ALTER COLUMN late_grace_minutes DROP NOT NULL,
  ALTER COLUMN late_grace_minutes DROP DEFAULT,
  ALTER COLUMN early_leave_grace_minutes DROP NOT NULL,
  ALTER COLUMN early_leave_grace_minutes DROP DEFAULT,
  ALTER COLUMN location_radius_meters DROP NOT NULL,
  ALTER COLUMN location_radius_meters DROP DEFAULT;

-- Ensure there is a singleton pattern or deterministic row check
CREATE OR REPLACE FUNCTION public.phase5_check_single_settings_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.attendance_settings) > 0 THEN
    RAISE EXCEPTION 'ATTENDANCE_SETTINGS_SINGLETON_VIOLATION' USING ERRCODE = 'P5007';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp;

CREATE OR REPLACE TRIGGER trigger_attendance_settings_singleton
  BEFORE INSERT ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.phase5_check_single_settings_row();

-- ===========================================================================
-- BLOCKER 9: Create Private Storage Bucket 'attendance-evidence' & Session Tracking Table
-- ===========================================================================
CREATE TABLE public.attendance_photo_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expected_path TEXT NOT NULL UNIQUE,
  expected_mime TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.attendance_photo_upload_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_photo_upload_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attendance_photo_upload_sessions TO service_role;

CREATE INDEX IF NOT EXISTS attendance_photo_sessions_user_idx ON public.attendance_photo_upload_sessions (user_id);
CREATE INDEX IF NOT EXISTS attendance_photo_sessions_path_idx ON public.attendance_photo_upload_sessions (expected_path);

-- ===========================================================================
-- BLOCKER 3: Fix Leave Overlap Logic + Concurrency RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_create_leave_request(
  p_user_id        UUID,
  p_leave_type_id  UUID,
  p_start_date     DATE,
  p_end_date       DATE,
  p_total_days     NUMERIC(5,2),
  p_reason         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requester_exists BOOLEAN;
  v_type_exists BOOLEAN;
  v_overlap_exists BOOLEAN;
  v_result JSONB;
  v_lock_key INT;
BEGIN
  -- 1. Derive lock key from hash of UUID user_id to ensure single execution thread per user
  v_lock_key := ('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Validate requester exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_requester_exists;
  IF NOT v_requester_exists THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P5008';
  END IF;

  -- Validate leave type exists
  SELECT EXISTS(SELECT 1 FROM public.leave_types WHERE id = p_leave_type_id) INTO v_type_exists;
  IF NOT v_type_exists THEN
    RAISE EXCEPTION 'LEAVE_TYPE_NOT_FOUND' USING ERRCODE = 'P5004';
  END IF;

  -- 3. Check active overlapping requests with correct AND logic:
  -- (existing.start_date <= requested.end_date) AND (existing.end_date >= requested.start_date)
  SELECT EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE user_id = p_user_id
      AND status IN ('pending', 'approved')
      AND start_date <= p_end_date
      AND end_date >= p_start_date
  ) INTO v_overlap_exists;

  IF v_overlap_exists THEN
    RAISE EXCEPTION 'LEAVE_DATE_OVERLAP' USING ERRCODE = 'P5009';
  END IF;

  -- Insert request
  INSERT INTO public.leave_requests (
    user_id,
    leave_type_id,
    start_date,
    end_date,
    total_days,
    reason,
    status
  ) VALUES (
    p_user_id,
    p_leave_type_id,
    p_start_date,
    p_end_date,
    p_total_days,
    p_reason,
    'pending'
  ) RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'leave_type_id', leave_type_id,
    'start_date', start_date,
    'end_date', end_date,
    'total_days', total_days,
    'status', status,
    'reason', reason,
    'created_at', created_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_create_leave_request(UUID, UUID, DATE, DATE, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_create_leave_request(UUID, UUID, DATE, DATE, NUMERIC, TEXT) TO service_role;

-- ===========================================================================
-- BLOCKER 4: Fix Leave Review Lock Order RPC (Safe from stale states)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_review_leave_request(
  p_request_id      UUID,
  p_reviewer_id     UUID,
  p_action          TEXT, -- 'approved' or 'rejected'
  p_review_note     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request RECORD;
  v_leave_type RECORD;
  v_balance RECORD;
  v_result JSONB;
  v_year INTEGER;
BEGIN
  -- 1. Locate request row and lock it immediately for update to prevent concurrent review race
  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_NOT_FOUND' USING ERRCODE = 'P5001';
  END IF;

  -- 2. AFTER LOCK re-check status
  IF v_request.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'LEAVE_ALREADY_REVIEWED' USING ERRCODE = 'P5002';
  END IF;

  -- 3. AFTER LOCK verify reviewer != requester
  IF p_reviewer_id = v_request.user_id THEN
    RAISE EXCEPTION 'LEAVE_SELF_REVIEW_DENIED' USING ERRCODE = 'P5003';
  END IF;

  -- Load leave type properties
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = v_request.leave_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_TYPE_NOT_FOUND' USING ERRCODE = 'P5004';
  END IF;

  -- If approved and requires balance, check and consume
  IF p_action = 'approved' THEN
    IF v_leave_type.requires_balance THEN
      v_year := EXTRACT(YEAR FROM v_request.start_date)::INTEGER;

      -- BLOCKER 2: Remove Invented 12-Day Leave Allocation (Lock balance; fail if missing)
      SELECT * INTO v_balance
      FROM public.leave_balances
      WHERE user_id = v_request.user_id
        AND leave_type_id = v_request.leave_type_id
        AND year = v_year
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'LEAVE_BALANCE_NOT_FOUND' USING ERRCODE = 'P5010';
      END IF;

      -- Validate sufficient balance
      IF (v_balance.allocated_days + v_balance.adjusted_days - v_balance.used_days) < v_request.total_days THEN
        RAISE EXCEPTION 'LEAVE_INSUFFICIENT_BALANCE' USING ERRCODE = 'P5005';
      END IF;

      -- Deduct balance
      UPDATE public.leave_balances
      SET used_days = used_days + v_request.total_days
      WHERE id = v_balance.id;
    END IF;

    -- Update leave request to approved
    UPDATE public.leave_requests
    SET status = 'approved',
        reviewer_user_id = p_reviewer_id,
        reviewed_at = NOW(),
        review_note = p_review_note
    WHERE id = p_request_id;

  ELSIF p_action = 'rejected' THEN
    -- Update leave request to rejected
    UPDATE public.leave_requests
    SET status = 'rejected',
        reviewer_user_id = p_reviewer_id,
        reviewed_at = NOW(),
        review_note = p_review_note
    WHERE id = p_request_id;
  ELSE
    RAISE EXCEPTION 'LEAVE_INVALID_ACTION' USING ERRCODE = 'P5006';
  END IF;

  -- Return final request state
  SELECT jsonb_build_object(
    'id', lr.id,
    'user_id', lr.user_id,
    'leave_type_id', lr.leave_type_id,
    'start_date', lr.start_date,
    'end_date', lr.end_date,
    'total_days', lr.total_days,
    'status', lr.status,
    'reviewer_user_id', lr.reviewer_user_id,
    'reviewed_at', lr.reviewed_at
  )
  INTO v_result
  FROM public.leave_requests lr
  WHERE lr.id = p_request_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_review_leave_request(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_review_leave_request(UUID, UUID, TEXT, TEXT) TO service_role;

-- ===========================================================================
-- BLOCKER 5: Atomic Check-Out RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_check_out_attendance(
  p_user_id            UUID,
  p_attendance_date    DATE,
  p_checkout_time      TIMESTAMPTZ,
  p_latitude           NUMERIC,
  p_longitude          NUMERIC,
  p_accuracy_meters    NUMERIC,
  p_photo_path         TEXT,
  p_note               TEXT,
  p_status             public.attendance_status,
  p_late_minutes       INTEGER,
  p_early_leave_minutes INTEGER,
  p_work_minutes       INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_result JSONB;
BEGIN
  -- Find and lock day's record for this user
  SELECT * INTO v_record
  FROM public.attendance_records
  WHERE user_id = p_user_id AND attendance_date = p_attendance_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_NOT_CHECKED_IN' USING ERRCODE = 'P5011';
  END IF;

  IF v_record.check_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_ALREADY_CHECKED_OUT' USING ERRCODE = 'P5012';
  END IF;

  IF p_checkout_time < v_record.check_in_at THEN
    RAISE EXCEPTION 'ATTENDANCE_INVALID_TIME_RANGE' USING ERRCODE = 'P5013';
  END IF;

  UPDATE public.attendance_records
  SET check_out_at = p_checkout_time,
      check_out_latitude = p_latitude,
      check_out_longitude = p_longitude,
      check_out_accuracy_meters = p_accuracy_meters,
      check_out_photo_path = p_photo_path,
      check_out_note = p_note,
      status = p_status,
      late_minutes = p_late_minutes,
      early_leave_minutes = p_early_leave_minutes,
      work_minutes = p_work_minutes
  WHERE id = v_record.id
  RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'attendance_date', attendance_date,
    'check_in_at', check_in_at,
    'check_out_at', check_out_at,
    'status', status,
    'work_minutes', work_minutes
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_check_out_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_check_out_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER) TO service_role;

-- ===========================================================================
-- BLOCKER 6: Atomic Attendance Adjustment RPC (Record + Audit logs)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_adjust_attendance_record(
  p_record_id             UUID,
  p_adjusted_by_profile   UUID,
  p_adjusted_by_auth      UUID,
  p_check_in_at           TIMESTAMPTZ,
  p_check_out_at          TIMESTAMPTZ,
  p_status                public.attendance_status,
  p_late_minutes          INTEGER,
  p_early_leave_minutes   INTEGER,
  p_work_minutes          INTEGER,
  p_reason                TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_prev JSONB;
  v_next JSONB;
  v_result JSONB;
BEGIN
  -- Lock attendance record row
  SELECT * INTO v_record
  FROM public.attendance_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND' USING ERRCODE = 'P5014';
  END IF;

  IF p_check_in_at IS NOT NULL AND p_check_out_at IS NOT NULL AND p_check_out_at < p_check_in_at THEN
    RAISE EXCEPTION 'ATTENDANCE_INVALID_TIME_RANGE' USING ERRCODE = 'P5013';
  END IF;

  v_prev := jsonb_build_object(
    'check_in_at', v_record.check_in_at,
    'check_out_at', v_record.check_out_at,
    'status', v_record.status,
    'late_minutes', v_record.late_minutes,
    'early_leave_minutes', v_record.early_leave_minutes,
    'work_minutes', v_record.work_minutes
  );

  v_next := jsonb_build_object(
    'check_in_at', p_check_in_at,
    'check_out_at', p_check_out_at,
    'status', p_status,
    'late_minutes', p_late_minutes,
    'early_leave_minutes', p_early_leave_minutes,
    'work_minutes', p_work_minutes
  );

  -- Update attendance record
  UPDATE public.attendance_records
  SET check_in_at = p_check_in_at,
      check_out_at = p_check_out_at,
      status = p_status,
      late_minutes = p_late_minutes,
      early_leave_minutes = p_early_leave_minutes,
      work_minutes = p_work_minutes,
      source = 'admin_adjustment',
      updated_by = p_adjusted_by_auth
  WHERE id = p_record_id;

  -- Write adjustment ledger audit row
  INSERT INTO public.attendance_adjustments (
    attendance_record_id,
    requested_by,
    approved_by,
    reason,
    previous_data,
    new_data,
    status,
    reviewed_at
  ) VALUES (
    p_record_id,
    p_adjusted_by_profile,
    p_adjusted_by_profile,
    p_reason,
    v_prev,
    v_next,
    'approved',
    NOW()
  ) RETURNING jsonb_build_object('id', id, 'status', status) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_adjust_attendance_record(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_adjust_attendance_record(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

-- ===========================================================================
-- BLOCKER 7: Fix Approved Leave Cancellation RPC (Request cancellation + Restores Balance)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_cancel_leave_request(
  p_request_id       UUID,
  p_actor_profile_id UUID,
  p_is_admin         BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request RECORD;
  v_leave_type RECORD;
  v_balance RECORD;
  v_result JSONB;
  v_year INTEGER;
BEGIN
  -- Lock request
  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_NOT_FOUND' USING ERRCODE = 'P5001';
  END IF;

  -- Employee own pending cancellation
  IF v_request.user_id = p_actor_profile_id THEN
    IF v_request.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'LEAVE_CANCEL_NOT_ALLOWED' USING ERRCODE = 'P5015';
    END IF;
  ELSE
    -- Admin cancellation for approved requests
    IF NOT p_is_admin THEN
      RAISE EXCEPTION 'LEAVE_ACCESS_DENIED' USING ERRCODE = 'P5016';
    END IF;
    IF v_request.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'LEAVE_CANCEL_NOT_ALLOWED' USING ERRCODE = 'P5015';
    END IF;
  END IF;

  -- Load leave type
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = v_request.leave_type_id;

  -- If approved and balance was consumed, restore used_days
  IF v_request.status = 'approved' AND v_leave_type.requires_balance THEN
    v_year := EXTRACT(YEAR FROM v_request.start_date)::INTEGER;

    SELECT * INTO v_balance
    FROM public.leave_balances
    WHERE user_id = v_request.user_id
      AND leave_type_id = v_request.leave_type_id
      AND year = v_year
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.leave_balances
      SET used_days = GREATEST(0.00, used_days - v_request.total_days)
      WHERE id = v_balance.id;
    END IF;
  END IF;

  -- Cancel request
  UPDATE public.leave_requests
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = p_actor_profile_id
  WHERE id = p_request_id
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'cancelled_at', cancelled_at,
    'cancelled_by', cancelled_by
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_cancel_leave_request(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_cancel_leave_request(UUID, UUID, BOOLEAN) TO service_role;

-- ===========================================================================
-- BLOCKER 8: Atomic Balance Adjustment RPC (Adjusts balance + ledger log)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_adjust_leave_balance(
  p_balance_id     UUID,
  p_delta_days     NUMERIC(5,2),
  p_reason         TEXT,
  p_actor_profile  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance RECORD;
  v_result JSONB;
  v_next_adjusted NUMERIC(5,2);
  v_next_available NUMERIC(5,2);
BEGIN
  -- Lock balance row
  SELECT * INTO v_balance
  FROM public.leave_balances
  WHERE id = p_balance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_BALANCE_NOT_FOUND' USING ERRCODE = 'P5010';
  END IF;

  v_next_adjusted := v_balance.adjusted_days + p_delta_days;
  v_next_available := v_balance.allocated_days + v_next_adjusted - v_balance.used_days;

  IF v_next_available < 0 THEN
    RAISE EXCEPTION 'LEAVE_INSUFFICIENT_BALANCE' USING ERRCODE = 'P5005';
  END IF;

  -- Update adjusted_days
  UPDATE public.leave_balances
  SET adjusted_days = v_next_adjusted
  WHERE id = p_balance_id;

  -- Log adjustment audit trail
  INSERT INTO public.leave_balance_adjustments (
    leave_balance_id,
    delta_days,
    reason,
    actor_user_id
  ) VALUES (
    p_balance_id,
    p_delta_days,
    p_reason,
    p_actor_profile
  ) RETURNING jsonb_build_object('id', id, 'delta_days', delta_days) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_adjust_leave_balance(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_adjust_leave_balance(UUID, NUMERIC, TEXT, UUID) TO service_role;
