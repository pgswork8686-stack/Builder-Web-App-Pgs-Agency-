-- ============================================================
-- Migration: PGS Work Calendar Monthly Alternating Saturday Schedule
-- Timestamp: 20260821100000_pgs_work_calendar_saturday_schedule.sql
-- Purpose:
--   Implement PGS Saturday work calendar rule:
--   Saturday resets every calendar month:
--   Saturday #1 of month -> WORK
--   Saturday #2 of month -> OFF
--   Saturday #3 of month -> WORK
--   Saturday #4 of month -> OFF
--   Saturday #5 of month -> WORK (if present)
--   Consecutive Saturdays across month boundaries can both be working days.
-- ============================================================

-- Add saturday_schedule_mode column to company_work_calendar_settings
ALTER TABLE public.company_work_calendar_settings
  ADD COLUMN IF NOT EXISTS saturday_schedule_mode TEXT NOT NULL DEFAULT 'monthly_alternating_reset';

-- Add check constraint for saturday_schedule_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_work_calendar_settings_saturday_mode_check'
  ) THEN
    ALTER TABLE public.company_work_calendar_settings
      ADD CONSTRAINT company_work_calendar_settings_saturday_mode_check
      CHECK (saturday_schedule_mode IN ('monthly_alternating_reset', 'anchor_alternating', 'all_working', 'all_off'));
  END IF;
END $$;

-- Update existing settings row to use monthly_alternating_reset
UPDATE public.company_work_calendar_settings
SET saturday_schedule_mode = 'monthly_alternating_reset'
WHERE saturday_schedule_mode IS NULL OR saturday_schedule_mode = 'anchor_alternating';

-- Update resolve_company_workday with the PGS Saturday schedule
CREATE OR REPLACE FUNCTION public.resolve_company_workday(p_date DATE)
RETURNS TABLE (
  work_date DATE,
  is_working_day BOOLEAN,
  reason TEXT,
  event_type TEXT,
  event_title TEXT,
  source_type TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_settings public.company_work_calendar_settings%ROWTYPE;
  v_event public.company_work_calendar_events%ROWTYPE;
  v_isodow INTEGER;
  v_saturday_number INTEGER;
  v_is_working_saturday BOOLEAN;
  v_week_offset INTEGER;
BEGIN
  SELECT * INTO v_settings
  FROM public.company_work_calendar_settings
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_CALENDAR_SETTINGS_NOT_FOUND';
  END IF;

  -- Priority 1: explicit manual Admin override.
  SELECT * INTO v_event
  FROM public.company_work_calendar_events e
  WHERE e.event_date = p_date
    AND e.status = 'active'
    AND e.source_type = 'manual'
  ORDER BY e.updated_at DESC, e.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT p_date, v_event.is_working_day, 'manual_override'::TEXT,
      v_event.event_type, v_event.title, v_event.source_type;
    RETURN;
  END IF;

  -- Priority 2/3: company holiday, then official public holiday.
  SELECT * INTO v_event
  FROM public.company_work_calendar_events e
  WHERE e.event_date = p_date
    AND e.status = 'active'
    AND e.event_type IN ('public_holiday','company_holiday')
  ORDER BY
    CASE WHEN e.event_type = 'company_holiday' THEN 0 ELSE 1 END,
    e.updated_at DESC,
    e.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT p_date, false, v_event.event_type,
      v_event.event_type, v_event.title, v_event.source_type;
    RETURN;
  END IF;

  -- Priority 4: government/special makeup workday, opt-in only.
  IF v_settings.apply_government_makeup_days THEN
    SELECT * INTO v_event
    FROM public.company_work_calendar_events e
    WHERE e.event_date = p_date
      AND e.status = 'active'
      AND e.event_type IN ('makeup_workday','special_workday')
      AND e.is_working_day = true
    ORDER BY e.updated_at DESC, e.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT p_date, true, v_event.event_type,
        v_event.event_type, v_event.title, v_event.source_type;
      RETURN;
    END IF;
  END IF;

  v_isodow := EXTRACT(ISODOW FROM p_date)::INTEGER;

  -- Priority 5: Saturday schedule
  IF v_isodow = 6 THEN
    IF v_settings.saturday_schedule_mode = 'monthly_alternating_reset' THEN
      -- Saturday ordinal: 1st..7th day = Sat #1, 8th..14th = Sat #2, 15th..21st = Sat #3, 22nd..28th = Sat #4, 29th..31st = Sat #5
      v_saturday_number := floor((EXTRACT(DAY FROM p_date) - 1) / 7) + 1;
      v_is_working_saturday := (mod(v_saturday_number, 2) = 1);

      RETURN QUERY SELECT p_date, v_is_working_saturday,
        'monthly_alternating_saturday'::TEXT, NULL::TEXT,
        CASE
          WHEN v_is_working_saturday THEN 'Thứ 7 làm việc theo lịch PGS'
          ELSE 'Nghỉ thứ 7 theo lịch PGS'
        END,
        'system'::TEXT;
      RETURN;
    ELSIF v_settings.saturday_schedule_mode = 'anchor_alternating'
          AND v_settings.alternate_saturday_enabled
          AND v_settings.alternate_saturday_anchor_date IS NOT NULL THEN
      v_week_offset := (p_date - v_settings.alternate_saturday_anchor_date) / 7;

      IF mod(abs(v_week_offset), 2) = 0 THEN
        RETURN QUERY SELECT p_date, v_settings.alternate_saturday_anchor_is_working,
          'alternate_saturday'::TEXT, NULL::TEXT,
          CASE
            WHEN v_settings.alternate_saturday_anchor_is_working
              THEN 'Thứ 7 đi làm theo lịch cách tuần'
            ELSE 'Nghỉ thứ 7 cách tuần'
          END,
          'system'::TEXT;
      ELSE
        RETURN QUERY SELECT p_date, NOT v_settings.alternate_saturday_anchor_is_working,
          'alternate_saturday'::TEXT, NULL::TEXT,
          CASE
            WHEN NOT v_settings.alternate_saturday_anchor_is_working
              THEN 'Thứ 7 đi làm theo lịch cách tuần'
            ELSE 'Nghỉ thứ 7 cách tuần'
          END,
          'system'::TEXT;
      END IF;
      RETURN;
    ELSIF v_settings.saturday_schedule_mode = 'all_working' THEN
      RETURN QUERY SELECT p_date, true, 'all_saturdays_working'::TEXT, NULL::TEXT, 'Thứ 7 làm việc'::TEXT, 'system'::TEXT;
      RETURN;
    ELSIF v_settings.saturday_schedule_mode = 'all_off' THEN
      RETURN QUERY SELECT p_date, false, 'all_saturdays_off'::TEXT, NULL::TEXT, 'Nghỉ thứ 7 hàng tuần'::TEXT, 'system'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Priority 6: regular ISO weekday/weekend rule (1=Mon ... 7=Sun).
  RETURN QUERY SELECT p_date,
    v_isodow = ANY(v_settings.weekday_working_days::INTEGER[]),
    CASE
      WHEN v_isodow = ANY(v_settings.weekday_working_days::INTEGER[])
        THEN 'regular_workday'
      ELSE 'weekly_off'
    END,
    NULL::TEXT,
    CASE
      WHEN v_isodow = ANY(v_settings.weekday_working_days::INTEGER[])
        THEN 'Ngày làm việc'
      ELSE 'Ngày nghỉ hàng tuần'
    END,
    'system'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_workday(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_workday(DATE) TO service_role;
