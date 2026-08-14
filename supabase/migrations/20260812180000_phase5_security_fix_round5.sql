-- Migration: Phase 5 - Security Fix Round 5 (Lock down attendance settings singleton check function)
-- Timestamp: 20260812180000_phase5_security_fix_round5.sql

-- ==========================================================================
-- 1. Revoke public/anon/authenticated execution from phase5_check_single_settings_row
-- ==========================================================================

REVOKE ALL ON FUNCTION public.phase5_check_single_settings_row() FROM PUBLIC, anon, authenticated;

-- ==========================================================================
-- 2. Grant execute privilege strictly to service_role
-- ==========================================================================

GRANT EXECUTE ON FUNCTION public.phase5_check_single_settings_row() TO service_role;
