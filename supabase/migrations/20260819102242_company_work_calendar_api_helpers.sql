-- ============================================================
-- Migration: Company Work Calendar API Helpers
-- Timestamp: 20260819102242_company_work_calendar_api_helpers.sql
-- Description:
--   Creates resolve_company_workday and get_company_work_calendar RPC functions
--   with set search_path = '' and deterministic priority resolution.
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
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings RECORD;
  v_event RECORD;
  v_dow INT;
  v_days_diff INT;
  v_is_even_cycle BOOLEAN;
  v_is_working_sat BOOLEAN;
BEGIN
  -- 1. Fetch settings
  SELECT * INTO v_settings FROM public.company_work_calendar_settings LIMIT 1;
  IF v_settings IS NULL THEN
    -- Fallback default: Mon-Fri working, Sat-Sun off
    v_dow := EXTRACT(DOW FROM p_date);
    IF v_dow BETWEEN 1 AND 5 THEN
      RETURN QUERY SELECT p_date, true, 'regular_workday'::TEXT, NULL::TEXT, 'Ngày làm việc'::TEXT, 'system'::TEXT;
    ELSE
      RETURN QUERY SELECT p_date, false, 'weekly_off'::TEXT, NULL::TEXT, 'Ngày nghỉ hàng tuần'::TEXT, 'system'::TEXT;
    END IF;
    RETURN;
  END IF;

  -- 2. Priority 1 & 2: Manual Admin Override & Active Events
  SELECT * INTO v_event
  FROM public.company_work_calendar_events e
  WHERE e.event_date = p_date AND e.status = 'active'
  ORDER BY 
    CASE e.source_type 
      WHEN 'manual' THEN 1 
      WHEN 'system' THEN 2 
      WHEN 'api' THEN 3 
      ELSE 4 
    END ASC,
    e.updated_at DESC
  LIMIT 1;

  IF v_event IS NOT NULL THEN
    RETURN QUERY SELECT 
      p_date,
      v_event.is_working_day,
      CASE 
        WHEN v_event.source_type = 'manual' THEN 'manual_override'
        WHEN v_event.event_type = 'public_holiday' THEN 'public_holiday'
        WHEN v_event.event_type = 'company_holiday' THEN 'company_holiday'
        WHEN v_event.event_type = 'makeup_workday' THEN 'makeup_workday'
        WHEN v_event.event_type = 'special_workday' THEN 'special_workday'
        ELSE 'calendar_event'
      END::TEXT,
      v_event.event_type::TEXT,
      v_event.title::TEXT,
      v_event.source_type::TEXT;
    RETURN;
  END IF;

  -- 3. Day of week calculation (0=Sun, 1=Mon, ..., 6=Sat)
  v_dow := EXTRACT(DOW FROM p_date);

  -- Check alternate Saturday
  IF v_dow = 6 AND v_settings.alternate_saturday_enabled THEN
    IF v_settings.alternate_saturday_anchor_date IS NOT NULL THEN
      v_days_diff := (p_date - v_settings.alternate_saturday_anchor_date);
      -- 14 days cycle
      IF (v_days_diff % 14 = 0) THEN
        v_is_working_sat := v_settings.alternate_saturday_anchor_is_working;
      ELSE
        v_is_working_sat := NOT v_settings.alternate_saturday_anchor_is_working;
      END IF;

      IF v_is_working_sat THEN
        RETURN QUERY SELECT p_date, true, 'alternate_saturday'::TEXT, NULL::TEXT, 'Thứ 7 đi làm theo lịch cách tuần'::TEXT, 'system'::TEXT;
      ELSE
        RETURN QUERY SELECT p_date, false, 'alternate_saturday'::TEXT, NULL::TEXT, 'Nghỉ thứ 7 cách tuần'::TEXT, 'system'::TEXT;
      END IF;
      RETURN;
    END IF;
  END IF;

  -- Check Sunday
  IF v_dow = 0 THEN
    RETURN QUERY SELECT p_date, false, 'weekly_off'::TEXT, NULL::TEXT, 'Ngày nghỉ hàng tuần'::TEXT, 'system'::TEXT;
    RETURN;
  END IF;

  -- Check weekday working days configuration
  IF v_dow = ANY(v_settings.weekday_working_days) THEN
    RETURN QUERY SELECT p_date, true, 'regular_workday'::TEXT, NULL::TEXT, 'Ngày làm việc'::TEXT, 'system'::TEXT;
  ELSE
    RETURN QUERY SELECT p_date, false, 'weekly_off'::TEXT, NULL::TEXT, 'Ngày nghỉ hàng tuần'::TEXT, 'system'::TEXT;
  END IF;
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
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM generate_series(p_from, p_to, '1 day'::interval) d(day_date)
  CROSS JOIN LATERAL public.resolve_company_workday(d.day_date::DATE) r
  ORDER BY r.work_date ASC;
END;
$$;
