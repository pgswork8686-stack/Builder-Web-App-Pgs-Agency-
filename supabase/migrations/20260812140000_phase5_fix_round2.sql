-- Migration: Phase 5 - Fix Round 2 (Harden Attendance Policy, Leave Calendar, & Storage Bucket Constraints)
-- Timestamp: 20260812140000_phase5_fix_round2.sql

-- ===========================================================================
-- BLOCKER 1: Explicitly migrate current attendance settings row to clear invented values
-- ===========================================================================
UPDATE public.attendance_settings
SET workday_start_time = NULL,
    workday_end_time = NULL,
    late_grace_minutes = NULL,
    early_leave_grace_minutes = NULL,
    location_radius_meters = NULL
WHERE timezone = 'Asia/Ho_Chi_Minh';

-- ===========================================================================
-- BLOCKER 3: Create Private Storage Bucket 'attendance-evidence' & Enhance Sessions
-- ===========================================================================
-- Insert attendance-evidence bucket registration if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-evidence',
  'attendance-evidence',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- Enhance attendance_photo_upload_sessions with stricter constraints
ALTER TABLE public.attendance_photo_upload_sessions
  ADD COLUMN IF NOT EXISTS expected_size INT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'attendance-evidence',
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

-- Add upload sessions validations constraints
ALTER TABLE public.attendance_photo_upload_sessions
  DROP CONSTRAINT IF EXISTS check_expected_size,
  DROP CONSTRAINT IF EXISTS check_expires_at,
  DROP CONSTRAINT IF EXISTS check_bucket_evidence,
  DROP CONSTRAINT IF EXISTS check_allowed_mimes;

ALTER TABLE public.attendance_photo_upload_sessions
  ADD CONSTRAINT check_expected_size CHECK (expected_size > 0 AND expected_size <= 5242880),
  ADD CONSTRAINT check_expires_at CHECK (expires_at > created_at),
  ADD CONSTRAINT check_bucket_evidence CHECK (storage_bucket = 'attendance-evidence'),
  ADD CONSTRAINT check_allowed_mimes CHECK (expected_mime IN ('image/jpeg', 'image/png', 'image/webp'));

-- ===========================================================================
-- BLOCKER 4: Re-declare Check-in and Checkout RPC to Claim & Verify Sessions Atomically
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_check_in_attendance(
  p_user_id             UUID,
  p_attendance_date     DATE,
  p_check_in_at         TIMESTAMPTZ,
  p_latitude            NUMERIC,
  p_longitude           NUMERIC,
  p_accuracy_meters     NUMERIC,
  p_photo_path          TEXT,
  p_note                TEXT,
  p_status              public.attendance_status,
  p_late_minutes        INTEGER,
  p_source              TEXT,
  p_created_by          UUID,
  p_updated_by          UUID,
  p_photo_session_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_session RECORD;
BEGIN
  -- Validate and consume photo session if provided
  IF p_photo_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.attendance_photo_upload_sessions
    WHERE id = p_photo_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_INVALID' USING ERRCODE = 'P5018';
    END IF;

    IF v_session.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_DENIED' USING ERRCODE = 'P5019';
    END IF;

    IF v_session.expires_at < NOW() THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_EXPIRED' USING ERRCODE = 'P5020';
    END IF;

    IF v_session.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_REUSED' USING ERRCODE = 'P5021';
    END IF;

    -- Update session as consumed
    UPDATE public.attendance_photo_upload_sessions
    SET consumed_at = NOW()
    WHERE id = p_photo_session_id;
  END IF;

  -- Insert attendance record
  INSERT INTO public.attendance_records (
    user_id,
    attendance_date,
    check_in_at,
    check_in_latitude,
    check_in_longitude,
    check_in_accuracy_meters,
    check_in_photo_path,
    check_in_note,
    status,
    late_minutes,
    source,
    created_by,
    updated_by
  ) VALUES (
    p_user_id,
    p_attendance_date,
    p_check_in_at,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_photo_path,
    p_note,
    p_status,
    p_late_minutes,
    p_source,
    p_created_by,
    p_updated_by
  ) RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'attendance_date', attendance_date,
    'check_in_at', check_in_at,
    'status', status
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.phase5_check_in_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_check_in_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, TEXT, UUID, UUID, UUID) TO service_role;


CREATE OR REPLACE FUNCTION public.phase5_check_out_attendance(
  p_user_id             UUID,
  p_attendance_date     DATE,
  p_checkout_time       TIMESTAMPTZ,
  p_latitude            NUMERIC,
  p_longitude           NUMERIC,
  p_accuracy_meters     NUMERIC,
  p_photo_path          TEXT,
  p_note                TEXT,
  p_status              public.attendance_status,
  p_late_minutes        INTEGER,
  p_early_leave_minutes INTEGER,
  p_work_minutes        INTEGER,
  p_photo_session_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_result JSONB;
  v_session RECORD;
BEGIN
  -- Lock the existing check-in record for update
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

  -- Validate and consume photo session if provided
  IF p_photo_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.attendance_photo_upload_sessions
    WHERE id = p_photo_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_INVALID' USING ERRCODE = 'P5018';
    END IF;

    IF v_session.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_DENIED' USING ERRCODE = 'P5019';
    END IF;

    IF v_session.expires_at < NOW() THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_EXPIRED' USING ERRCODE = 'P5020';
    END IF;

    IF v_session.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_REUSED' USING ERRCODE = 'P5021';
    END IF;

    -- Update session as consumed
    UPDATE public.attendance_photo_upload_sessions
    SET consumed_at = NOW()
    WHERE id = p_photo_session_id;
  END IF;

  -- Update attendance check-out details
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

REVOKE ALL ON FUNCTION public.phase5_check_out_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_check_out_attendance(UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID) TO service_role;

-- ===========================================================================
-- BLOCKER 5: Fix Attendance Adjustment Omit Semantics
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.phase5_adjust_attendance_record(
  p_record_id             UUID,
  p_adjusted_by_profile   UUID,
  p_adjusted_by_auth      UUID,
  p_set_check_in          BOOLEAN,
  p_check_in_at           TIMESTAMPTZ,
  p_set_check_out         BOOLEAN,
  p_check_out_at          TIMESTAMPTZ,
  p_set_status            BOOLEAN,
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
  v_final_check_in TIMESTAMPTZ;
  v_final_check_out TIMESTAMPTZ;
  v_final_status public.attendance_status;
BEGIN
  -- Lock record row
  SELECT * INTO v_record
  FROM public.attendance_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND' USING ERRCODE = 'P5014';
  END IF;

  -- Omitted vs explicit null check
  v_final_check_in := CASE WHEN p_set_check_in THEN p_check_in_at ELSE v_record.check_in_at END;
  v_final_check_out := CASE WHEN p_set_check_out THEN p_check_out_at ELSE v_record.check_out_at END;
  v_final_status := CASE WHEN p_set_status THEN p_status ELSE v_record.status END;

  IF v_final_check_in IS NOT NULL AND v_final_check_out IS NOT NULL AND v_final_check_out < v_final_check_in THEN
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
    'check_in_at', v_final_check_in,
    'check_out_at', v_final_check_out,
    'status', v_final_status,
    'late_minutes', p_late_minutes,
    'early_leave_minutes', p_early_leave_minutes,
    'work_minutes', p_work_minutes
  );

  -- Perform update
  UPDATE public.attendance_records
  SET check_in_at = v_final_check_in,
      check_out_at = v_final_check_out,
      status = v_final_status,
      late_minutes = p_late_minutes,
      early_leave_minutes = p_early_leave_minutes,
      work_minutes = p_work_minutes,
      source = 'admin_adjustment',
      updated_by = p_adjusted_by_auth
  WHERE id = p_record_id;

  -- Insert adjustment log trail
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

REVOKE ALL ON FUNCTION public.phase5_adjust_attendance_record(UUID, UUID, UUID, BOOLEAN, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, BOOLEAN, public.attendance_status, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_adjust_attendance_record(UUID, UUID, UUID, BOOLEAN, TIMESTAMPTZ, BOOLEAN, TIMESTAMPTZ, BOOLEAN, public.attendance_status, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

-- ===========================================================================
-- BLOCKER 6: Harden Approved Leave Cancellation RPC
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
  -- Lock request row
  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_NOT_FOUND' USING ERRCODE = 'P5001';
  END IF;

  -- Check status to prevent double cancel restoration
  IF v_request.status = 'cancelled' THEN
    RAISE EXCEPTION 'LEAVE_CANCEL_NOT_ALLOWED' USING ERRCODE = 'P5015';
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

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LEAVE_BALANCE_NOT_FOUND' USING ERRCODE = 'P5010';
    END IF;

    -- Strict balance validation check
    IF v_balance.used_days < v_request.total_days THEN
      RAISE EXCEPTION 'LEAVE_BALANCE_INCONSISTENT' USING ERRCODE = 'P5017';
    END IF;

    UPDATE public.leave_balances
    SET used_days = used_days - v_request.total_days
    WHERE id = v_balance.id;
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
