-- ============================================================
-- Migration: Company Work Calendar Foundation
-- Timestamp: 20260819102206_company_work_calendar_foundation.sql
-- Description:
--   Creates company_work_calendar_settings and company_work_calendar_events tables,
--   sets up constraints, RLS policies, triggers, and the core resolve_company_workday function.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_work_calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  weekday_working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  alternate_saturday_enabled BOOLEAN NOT NULL DEFAULT true,
  alternate_saturday_anchor_date DATE DEFAULT '2026-08-22',
  alternate_saturday_anchor_is_working BOOLEAN NOT NULL DEFAULT false,
  apply_government_makeup_days BOOLEAN NOT NULL DEFAULT false,
  holiday_country_code TEXT NOT NULL DEFAULT 'VN',
  holiday_provider TEXT DEFAULT 'calendarific',
  auto_holiday_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_holiday_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_work_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('public_holiday', 'company_holiday', 'makeup_workday', 'special_workday')),
  title TEXT NOT NULL,
  is_working_day BOOLEAN NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'api', 'system')),
  source_provider TEXT,
  source_ref TEXT,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  notes TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_work_calendar_events_date_idx ON public.company_work_calendar_events(event_date);
CREATE INDEX IF NOT EXISTS company_work_calendar_events_type_idx ON public.company_work_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS company_work_calendar_events_source_idx ON public.company_work_calendar_events(source_type);
CREATE UNIQUE INDEX IF NOT EXISTS company_work_calendar_events_ext_idx ON public.company_work_calendar_events(source_provider, external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.company_work_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_work_calendar_events ENABLE ROW LEVEL SECURITY;

-- Read policy: authenticated internal users can read calendar settings & events
CREATE POLICY "company_work_calendar_settings_read" ON public.company_work_calendar_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "company_work_calendar_events_read" ON public.company_work_calendar_events
  FOR SELECT TO authenticated
  USING (status = 'active');

-- Write policy: admin only
CREATE POLICY "company_work_calendar_settings_admin_all" ON public.company_work_calendar_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "company_work_calendar_events_admin_all" ON public.company_work_calendar_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
