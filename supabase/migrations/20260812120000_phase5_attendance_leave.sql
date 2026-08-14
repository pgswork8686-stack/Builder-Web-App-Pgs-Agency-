-- Migration: Phase 5 - Attendance & Leave Management
-- Timestamp: 20260812120000_phase5_attendance_leave.sql

-- ==================================================
-- 1. Create Enums & Custom Types
-- ==================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE public.attendance_status AS ENUM (
      'present',
      'late',
      'early_leave',
      'late_and_early_leave',
      'incomplete',
      'absent',
      'on_leave'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
    CREATE TYPE public.attendance_source AS ENUM (
      'web',
      'mobile',
      'admin_adjustment'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_request_status') THEN
    CREATE TYPE public.leave_request_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_status') THEN
    CREATE TYPE public.adjustment_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  END IF;
END $$;

-- ==================================================
-- 2. Create Attendance Policy / Settings Table
-- ==================================================

CREATE TABLE public.attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  workday_start_time TIME NOT NULL DEFAULT '08:30:00',
  workday_end_time TIME NOT NULL DEFAULT '17:30:00',
  late_grace_minutes INTEGER NOT NULL DEFAULT 15,
  early_leave_grace_minutes INTEGER NOT NULL DEFAULT 15,
  location_required BOOLEAN NOT NULL DEFAULT FALSE,
  photo_required BOOLEAN NOT NULL DEFAULT FALSE,
  location_radius_meters NUMERIC NOT NULL DEFAULT 200,
  office_latitude NUMERIC,
  office_longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings row
INSERT INTO public.attendance_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ==================================================
-- 3. Create Attendance Records Table
-- ==================================================

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_latitude NUMERIC,
  check_in_longitude NUMERIC,
  check_out_latitude NUMERIC,
  check_out_longitude NUMERIC,
  check_in_accuracy_meters NUMERIC,
  check_out_accuracy_meters NUMERIC,
  check_in_photo_path TEXT,
  check_out_photo_path TEXT,
  check_in_note TEXT,
  check_out_note TEXT,
  status public.attendance_status NOT NULL DEFAULT 'incomplete',
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  work_minutes INTEGER,
  source public.attendance_source NOT NULL DEFAULT 'web',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, attendance_date),
  CONSTRAINT check_checkout_after_checkin CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at),
  CONSTRAINT check_late_minutes_nonnegative CHECK (late_minutes >= 0),
  CONSTRAINT check_early_leave_minutes_nonnegative CHECK (early_leave_minutes >= 0),
  CONSTRAINT check_work_minutes_nonnegative CHECK (work_minutes IS NULL OR work_minutes >= 0),
  CONSTRAINT check_check_in_latitude CHECK (check_in_latitude IS NULL OR (check_in_latitude >= -90 AND check_in_latitude <= 90)),
  CONSTRAINT check_check_in_longitude CHECK (check_in_longitude IS NULL OR (check_in_longitude >= -180 AND check_in_longitude <= 180)),
  CONSTRAINT check_check_out_latitude CHECK (check_out_latitude IS NULL OR (check_out_latitude >= -90 AND check_out_latitude <= 90)),
  CONSTRAINT check_check_out_longitude CHECK (check_out_longitude IS NULL OR (check_out_longitude >= -180 AND check_out_longitude <= 180)),
  CONSTRAINT check_check_in_accuracy CHECK (check_in_accuracy_meters IS NULL OR check_in_accuracy_meters >= 0),
  CONSTRAINT check_check_out_accuracy CHECK (check_out_accuracy_meters IS NULL OR check_out_accuracy_meters >= 0)
);

-- ==================================================
-- 4. Create Attendance Adjustments Table (Audit Trail)
-- ==================================================

CREATE TABLE public.attendance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  previous_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  status public.adjustment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ==================================================
-- 5. Create Leave Types Table
-- ==================================================

CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  requires_balance BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_leave_type_code_length CHECK (length(code) >= 2 AND length(code) <= 30),
  CONSTRAINT check_leave_type_name_length CHECK (length(name) >= 2 AND length(name) <= 120)
);

-- Seed default leave types
INSERT INTO public.leave_types (code, name, description, requires_balance) VALUES
  ('annual', 'Nghỉ phép năm', 'Nghỉ phép năm hưởng lương theo chế độ', TRUE),
  ('sick', 'Nghỉ ốm', 'Nghỉ do đau ốm, bệnh tật', FALSE),
  ('unpaid', 'Nghỉ không lương', 'Nghỉ phép không hưởng lương', FALSE),
  ('other', 'Nghỉ khác', 'Các lý do nghỉ việc đột xuất khác', FALSE)
ON CONFLICT (code) DO NOTHING;

-- ==================================================
-- 6. Create Leave Balances Table
-- ==================================================

CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  allocated_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  used_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  adjusted_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, leave_type_id, year),
  CONSTRAINT check_allocated_days_nonnegative CHECK (allocated_days >= 0),
  CONSTRAINT check_used_days_nonnegative CHECK (used_days >= 0),
  -- Available balance (allocated_days + adjusted_days - used_days) must not be negative unless allowed by business logic
  CONSTRAINT check_available_days_limit CHECK (allocated_days + adjusted_days - used_days >= 0)
);

-- ==================================================
-- 7. Create Leave Requests Table
-- ==================================================

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status public.leave_request_status NOT NULL DEFAULT 'pending',
  reviewer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_end_after_start CHECK (end_date >= start_date),
  CONSTRAINT check_total_days_positive CHECK (total_days > 0),
  CONSTRAINT check_no_self_review CHECK (reviewer_user_id IS NULL OR reviewer_user_id <> user_id),
  CONSTRAINT check_review_details CHECK (
    (status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL) OR
    (status = 'cancelled') OR
    (status IN ('approved', 'rejected') AND reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

-- ==================================================
-- 8. Create Leave Balance Adjustments Table (Audit Trail)
-- ==================================================

CREATE TABLE public.leave_balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_balance_id UUID NOT NULL REFERENCES public.leave_balances(id) ON DELETE CASCADE,
  delta_days NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- 9. Add updated_at Triggers
-- ==================================================

CREATE TRIGGER trigger_set_updated_at_attendance_settings BEFORE UPDATE ON public.attendance_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_attendance_records BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_leave_types BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_leave_balances BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_leave_requests BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==================================================
-- 10. Enable Row Level Security (RLS)
-- ==================================================

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Revoke all public, anon, and authenticated browser access
REVOKE ALL ON public.attendance_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.attendance_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.attendance_adjustments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leave_types FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leave_balances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leave_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leave_balance_adjustments FROM PUBLIC, anon, authenticated;

-- Grant required access ONLY to service_role
GRANT ALL ON public.attendance_settings TO service_role;
GRANT ALL ON public.attendance_records TO service_role;
GRANT ALL ON public.attendance_adjustments TO service_role;
GRANT ALL ON public.leave_types TO service_role;
GRANT ALL ON public.leave_balances TO service_role;
GRANT ALL ON public.leave_requests TO service_role;
GRANT ALL ON public.leave_balance_adjustments TO service_role;

-- ==================================================
-- 11. Create Performance Indexes
-- ==================================================

CREATE INDEX IF NOT EXISTS attendance_records_user_date_idx ON public.attendance_records (user_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS attendance_records_date_status_idx ON public.attendance_records (attendance_date, status);
CREATE INDEX IF NOT EXISTS attendance_records_date_user_idx ON public.attendance_records (attendance_date, user_id);

CREATE INDEX IF NOT EXISTS leave_requests_user_created_idx ON public.leave_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_requests_status_dates_idx ON public.leave_requests (status, start_date, end_date);
CREATE INDEX IF NOT EXISTS leave_requests_dates_idx ON public.leave_requests (start_date, end_date);

CREATE INDEX IF NOT EXISTS leave_balances_user_year_idx ON public.leave_balances (user_id, year);
CREATE INDEX IF NOT EXISTS leave_balances_type_year_idx ON public.leave_balances (leave_type_id, year);


-- ==================================================
-- 12. Create Atomic Leave Review Transaction RPC
-- ==================================================

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
BEGIN
  -- 1. Fetch request context
  SELECT lr.*, p.role AS requester_role
  INTO v_request
  FROM public.leave_requests lr
  JOIN public.profiles p ON lr.user_id = p.id
  WHERE lr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_REQUEST_NOT_FOUND' USING ERRCODE = 'P5001';
  END IF;

  -- 2. Validate state is pending
  IF v_request.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'LEAVE_ALREADY_REVIEWED' USING ERRCODE = 'P5002';
  END IF;

  -- 3. Validate reviewer != requester
  IF p_reviewer_id = v_request.user_id THEN
    RAISE EXCEPTION 'LEAVE_SELF_REVIEW_DENIED' USING ERRCODE = 'P5003';
  END IF;

  -- Get leave type properties
  SELECT * INTO v_leave_type
  FROM public.leave_types
  WHERE id = v_request.leave_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAVE_TYPE_NOT_FOUND' USING ERRCODE = 'P5004';
  END IF;

  -- Lock leave request row atomically
  PERFORM 1 FROM public.leave_requests WHERE id = p_request_id FOR UPDATE;

  -- If approved and requires balance, check and consume
  IF p_action = 'approved' THEN
    IF v_leave_type.requires_balance THEN
      -- Lock the specific leave balance row for requester, leave type and start date's year
      SELECT * INTO v_balance
      FROM public.leave_balances
      WHERE user_id = v_request.user_id
        AND leave_type_id = v_request.leave_type_id
        AND year = EXTRACT(YEAR FROM v_request.start_date)::INTEGER
      FOR UPDATE;

      -- If balance doesn't exist, try to initialize it
      IF NOT FOUND THEN
        -- Check if user is active & employee to initialize
        INSERT INTO public.leave_balances (user_id, leave_type_id, year, allocated_days, used_days)
        VALUES (v_request.user_id, v_request.leave_type_id, EXTRACT(YEAR FROM v_request.start_date)::INTEGER, 12.00, 0.00)
        RETURNING * INTO v_balance;
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

-- Revoke execute on review RPC from public/anon/authenticated and grant to service_role only
REVOKE ALL ON FUNCTION public.phase5_review_leave_request(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase5_review_leave_request(UUID, UUID, TEXT, TEXT) TO service_role;
