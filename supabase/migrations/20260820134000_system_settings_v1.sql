-- ============================================================
-- Migration: System Settings Module V1
-- Timestamp: 20260820134000_system_settings_v1.sql
-- Entity: system_settings
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('general', 'attendance', 'finance', 'security', 'notifications')),
  value JSONB NOT NULL,
  description TEXT,
  updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by_user_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings(updated_by_user_id);

-- Companion sync for system_settings
CREATE OR REPLACE FUNCTION public.tg_sync_system_settings_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.updated_by_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.updated_by_user_code FROM public.profiles WHERE id = NEW.updated_by_user_id;
  ELSE
    NEW.updated_by_user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_settings_companion_codes ON public.system_settings;
CREATE TRIGGER trg_sync_system_settings_companion_codes
  BEFORE INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_system_settings_companion_codes();

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;

-- Seed initial system settings if empty
INSERT INTO public.system_settings (key, category, value, description)
VALUES
  ('company_info', 'general', '{"name": "PGS Agency Hub", "hotline": "1900 8686", "email": "contact@pgsagency.vn", "address": "TP. Hà Nội, Việt Nam"}'::jsonb, 'Thông tin liên hệ chung của công ty'),
  ('attendance_policy', 'attendance', '{"radius_meters": 150, "allow_remote": true}'::jsonb, 'Quy định chấm công và geofencing'),
  ('finance_defaults', 'finance', '{"currency": "VND", "vat_rate": 10, "auto_invoice_reminder_days": 3}'::jsonb, 'Cấu hình mặc định tài chính và hóa đơn'),
  ('security_policy', 'security', '{"mfa_required": false, "session_timeout_hours": 24, "rate_limit_rpm": 120}'::jsonb, 'Cấu hình chính sách bảo mật hệ thống')
ON CONFLICT (key) DO NOTHING;
