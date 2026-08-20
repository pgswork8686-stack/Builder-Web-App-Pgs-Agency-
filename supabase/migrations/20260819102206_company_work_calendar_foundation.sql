-- ============================================================
-- Migration: Company Work Calendar Foundation
-- Timestamp: 20260819102206_company_work_calendar_foundation.sql
-- Purpose:
--   Reconciled source-of-truth for the schema already running in Production.
--   Business tables remain backend-only: browser roles receive no direct table
--   privileges and NestJS accesses them through the service-role system client.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_work_calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  weekday_working_days SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  alternate_saturday_enabled BOOLEAN NOT NULL DEFAULT true,
  alternate_saturday_anchor_date DATE,
  alternate_saturday_anchor_is_working BOOLEAN NOT NULL DEFAULT false,
  apply_government_makeup_days BOOLEAN NOT NULL DEFAULT false,
  holiday_country_code TEXT NOT NULL DEFAULT 'VN',
  holiday_provider TEXT,
  auto_holiday_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_holiday_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_work_calendar_settings_weekdays_valid
    CHECK (weekday_working_days <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]),
  CONSTRAINT company_work_calendar_settings_country_code_valid
    CHECK (holiday_country_code ~ '^[A-Z]{2}$')
);

CREATE TABLE IF NOT EXISTS public.company_work_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  is_working_day BOOLEAN NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_provider TEXT,
  source_ref TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_work_calendar_events_event_type_check
    CHECK (event_type IN ('public_holiday','company_holiday','makeup_workday','special_workday')),
  CONSTRAINT company_work_calendar_events_source_type_check
    CHECK (source_type IN ('manual','api','government_notice','system')),
  CONSTRAINT company_work_calendar_events_status_check
    CHECK (status IN ('pending','active','ignored'))
);

CREATE TABLE IF NOT EXISTS public.company_holiday_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'VN',
  holiday_year INTEGER NOT NULL,
  status TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT company_holiday_sync_runs_country_code_valid
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT company_holiday_sync_runs_year_valid
    CHECK (holiday_year >= 2000 AND holiday_year <= 2100),
  CONSTRAINT company_holiday_sync_runs_status_check
    CHECK (status IN ('running','succeeded','failed')),
  CONSTRAINT company_holiday_sync_runs_imported_count_check
    CHECK (imported_count >= 0)
);

CREATE INDEX IF NOT EXISTS company_work_calendar_events_date_status_idx
  ON public.company_work_calendar_events(event_date, status);

CREATE UNIQUE INDEX IF NOT EXISTS company_work_calendar_external_uidx
  ON public.company_work_calendar_events(source_provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_work_calendar_manual_active_date_uidx
  ON public.company_work_calendar_events(event_date)
  WHERE source_type = 'manual' AND status = 'active';

CREATE INDEX IF NOT EXISTS company_holiday_sync_runs_lookup_idx
  ON public.company_holiday_sync_runs(provider, country_code, holiday_year, started_at DESC);

ALTER TABLE public.company_work_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_work_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holiday_sync_runs ENABLE ROW LEVEL SECURITY;

-- Backend-only business data. No browser policies are intentionally created.
REVOKE ALL ON TABLE public.company_work_calendar_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_work_calendar_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company_holiday_sync_runs FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.company_work_calendar_settings TO service_role;
GRANT ALL ON TABLE public.company_work_calendar_events TO service_role;
GRANT ALL ON TABLE public.company_holiday_sync_runs TO service_role;

DROP TRIGGER IF EXISTS trigger_set_updated_at_company_work_calendar_settings
  ON public.company_work_calendar_settings;
CREATE TRIGGER trigger_set_updated_at_company_work_calendar_settings
BEFORE UPDATE ON public.company_work_calendar_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_company_work_calendar_events
  ON public.company_work_calendar_events;
CREATE TRIGGER trigger_set_updated_at_company_work_calendar_events
BEFORE UPDATE ON public.company_work_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One canonical company calendar configuration. UUID remains generated by DB.
INSERT INTO public.company_work_calendar_settings (
  timezone,
  weekday_working_days,
  alternate_saturday_enabled,
  alternate_saturday_anchor_date,
  alternate_saturday_anchor_is_working,
  apply_government_makeup_days,
  holiday_country_code,
  holiday_provider,
  auto_holiday_sync_enabled
)
SELECT
  'Asia/Ho_Chi_Minh',
  ARRAY[1,2,3,4,5]::SMALLINT[],
  true,
  DATE '2026-08-22',
  false,
  false,
  'VN',
  'calendarific',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_work_calendar_settings
);
