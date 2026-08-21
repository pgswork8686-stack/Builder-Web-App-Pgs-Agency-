-- ============================================================
-- Migration: Company Work Calendar API Helpers
-- Timestamp: 20260819102242_company_work_calendar_api_helpers.sql
-- Purpose:
--   Reconciled with Production. Functions are SECURITY INVOKER and executable
--   only by service_role. Government makeup/special workdays are ignored unless
--   apply_government_makeup_days is enabled in company settings.
-- ============================================================

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

  -- Priority 5: alternate Saturday anchored at 2026-08-22 by current settings.
  IF v_isodow = 6
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

CREATE OR REPLACE FUNCTION public.get_company_work_calendar(p_from DATE, p_to DATE)
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
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'INVALID_WORK_CALENDAR_RANGE';
  END IF;

  IF (p_to - p_from) > 400 THEN
    RAISE EXCEPTION 'WORK_CALENDAR_RANGE_TOO_LARGE';
  END IF;

  RETURN QUERY
  SELECT r.work_date, r.is_working_day, r.reason, r.event_type, r.event_title, r.source_type
  FROM generate_series(p_from::TIMESTAMP, p_to::TIMESTAMP, INTERVAL '1 day') g(day)
  CROSS JOIN LATERAL public.resolve_company_workday(g.day::DATE) r;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_workday(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_company_work_calendar(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_workday(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_company_work_calendar(DATE, DATE) TO service_role;
