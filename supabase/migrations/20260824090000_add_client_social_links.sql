-- ============================================================
-- Migration: Add Social Links to Client Companies
-- Timestamp: 20260824090000_add_client_social_links.sql
-- ============================================================

ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS zalo TEXT,
  ADD COLUMN IF NOT EXISTS messenger TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT;

COMMENT ON COLUMN public.client_companies.zalo IS 'Zalo phone number or direct chat URL';
COMMENT ON COLUMN public.client_companies.messenger IS 'Facebook Messenger URL or username';
COMMENT ON COLUMN public.client_companies.facebook IS 'Facebook Profile or Fanpage URL';
