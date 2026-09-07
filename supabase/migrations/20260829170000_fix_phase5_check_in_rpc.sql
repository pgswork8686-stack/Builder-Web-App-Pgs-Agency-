-- Migration: Fix phase5_check_in_attendance type casting for p_source
-- Timestamp: 20260829170000_fix_phase5_check_in_rpc.sql

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

    v_photo_path := v_session.expected_path;

    UPDATE public.attendance_photo_upload_sessions
    SET consumed_at = NOW()
    WHERE id = p_photo_session_id
      AND consumed_at IS NULL;
  END IF;

  -- Insert attendance check-in record with explicit enum type cast for source
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
