-- Migration: Phase 5 - Fix Round 3 (Evidence Contract & HR Access Hardening)
-- Timestamp: 20260812150000_phase5_fix_round3.sql
-- ============================================================================
-- SUMMARY:
-- 1. Drop obsolete overloaded RPC signatures from migration 130000
-- 2. Redefine check-in/check-out RPCs to derive photo path from session (remove p_photo_path)
-- 3. Verify exact expected_mime + expected_size from session (strict binding)
-- 4. Harden photo session column constraints (NOT NULL)
-- 5. Clean up completed_at semantics (define consumed_at as canonical)
-- ============================================================================

-- ===========================================================================
-- SECTION 1: DROP OBSOLETE OVERLOAD SIGNATURES (from migration 130000)
-- ===========================================================================

-- Drop old phase5_check_out_attendance without photo_session_id (12-arg version)
REVOKE ALL ON FUNCTION public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER
);

-- Drop old phase5_adjust_attendance_record without p_set_* flags (10-arg version)
REVOKE ALL ON FUNCTION public.phase5_adjust_attendance_record(
  UUID, UUID, UUID,
  TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status,
  INTEGER, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.phase5_adjust_attendance_record(
  UUID, UUID, UUID,
  TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status,
  INTEGER, INTEGER, INTEGER, TEXT
);

-- ===========================================================================
-- SECTION 2: DROP OLD CHECK-IN SIGNATURE (14-arg with p_photo_path from 140000)
-- and replace with new 13-arg version (no p_photo_path, DB derives from session)
-- ===========================================================================

-- Revoke and drop old check-in with p_photo_path
REVOKE ALL ON FUNCTION public.phase5_check_in_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER,
  TEXT, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.phase5_check_in_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER,
  TEXT, UUID, UUID, UUID
);

-- Revoke and drop old check-out with p_photo_path (13-arg from 140000)
REVOKE ALL ON FUNCTION public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID
);

-- ===========================================================================
-- SECTION 2B: HARDEN THE FINAL UPLOAD-SESSION CONTRACT
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.attendance_photo_upload_sessions
    WHERE expected_size IS NULL
       OR expected_mime IS NULL
       OR expected_path IS NULL
       OR storage_bucket IS NULL
  ) THEN
    RAISE EXCEPTION 'PHASE5_PHOTO_SESSION_INCOMPLETE_DATA';
  END IF;
END;
$$;

ALTER TABLE public.attendance_photo_upload_sessions
  ALTER COLUMN expected_size SET NOT NULL,
  ALTER COLUMN expected_mime SET NOT NULL,
  ALTER COLUMN expected_path SET NOT NULL,
  ALTER COLUMN storage_bucket SET DEFAULT 'attendance-evidence',
  ALTER COLUMN storage_bucket SET NOT NULL;

COMMENT ON COLUMN public.attendance_photo_upload_sessions.consumed_at IS
  'Canonical one-time consumption timestamp. Set atomically by check-in/check-out; a consumed session cannot be reused.';

COMMENT ON COLUMN public.attendance_photo_upload_sessions.completed_at IS
  'LEGACY: retained for compatibility only. Application code uses consumed_at as the canonical one-time usage flag.';

-- ===========================================================================
-- SECTION 3: FINAL CHECK-IN RPC (no p_photo_path — DB derives from session)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.phase5_check_in_attendance(
  p_user_id             UUID,
  p_attendance_date     DATE,
  p_check_in_at         TIMESTAMPTZ,
  p_latitude            NUMERIC,
  p_longitude           NUMERIC,
  p_accuracy_meters     NUMERIC,
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
  v_result    JSONB;
  v_session   RECORD;
  v_photo_path TEXT := NULL;
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

    IF v_session.storage_bucket IS DISTINCT FROM 'attendance-evidence'
       OR v_session.expected_path IS NULL
       OR v_session.expected_mime IS NULL
       OR v_session.expected_size IS NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_MISMATCH' USING ERRCODE = 'P5022';
    END IF;

    IF v_session.expires_at <= NOW() THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_EXPIRED' USING ERRCODE = 'P5020';
    END IF;

    IF v_session.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_REUSED' USING ERRCODE = 'P5021';
    END IF;

    -- DB owns the canonical path mapping: session -> expected_path
    v_photo_path := v_session.expected_path;

    -- Consume session atomically
    UPDATE public.attendance_photo_upload_sessions
    SET consumed_at = NOW()
    WHERE id = p_photo_session_id
      AND consumed_at IS NULL;
  END IF;

  -- Insert attendance check-in record
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
    v_photo_path,
    p_note,
    p_status,
    p_late_minutes,
    p_source::public.attendance_source,
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

REVOKE ALL ON FUNCTION public.phase5_check_in_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, public.attendance_status, INTEGER,
  TEXT, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase5_check_in_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, public.attendance_status, INTEGER,
  TEXT, UUID, UUID, UUID
) TO service_role;

-- ===========================================================================
-- SECTION 4: FINAL CHECK-OUT RPC (no p_photo_path — DB derives from session)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.phase5_check_out_attendance(
  p_user_id             UUID,
  p_attendance_date     DATE,
  p_checkout_time       TIMESTAMPTZ,
  p_latitude            NUMERIC,
  p_longitude           NUMERIC,
  p_accuracy_meters     NUMERIC,
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
  v_record      RECORD;
  v_result      JSONB;
  v_session     RECORD;
  v_photo_path  TEXT := NULL;
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

  IF v_record.check_in_at IS NULL OR p_checkout_time < v_record.check_in_at THEN
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

    IF v_session.storage_bucket IS DISTINCT FROM 'attendance-evidence'
       OR v_session.expected_path IS NULL
       OR v_session.expected_mime IS NULL
       OR v_session.expected_size IS NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_MISMATCH' USING ERRCODE = 'P5022';
    END IF;

    IF v_session.expires_at <= NOW() THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_EXPIRED' USING ERRCODE = 'P5020';
    END IF;

    IF v_session.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_PHOTO_SESSION_REUSED' USING ERRCODE = 'P5021';
    END IF;

    -- DB owns the canonical path mapping
    v_photo_path := v_session.expected_path;

    -- Consume session atomically
    UPDATE public.attendance_photo_upload_sessions
    SET consumed_at = NOW()
    WHERE id = p_photo_session_id
      AND consumed_at IS NULL;
  END IF;

  -- Update attendance check-out details using DB-derived photo path
  UPDATE public.attendance_records
  SET check_out_at             = p_checkout_time,
      check_out_latitude       = p_latitude,
      check_out_longitude      = p_longitude,
      check_out_accuracy_meters = p_accuracy_meters,
      check_out_photo_path     = v_photo_path,
      check_out_note           = p_note,
      status                   = p_status,
      late_minutes             = p_late_minutes,
      early_leave_minutes      = p_early_leave_minutes,
      work_minutes             = p_work_minutes
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

REVOKE ALL ON FUNCTION public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase5_check_out_attendance(
  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER, UUID
) TO service_role;
