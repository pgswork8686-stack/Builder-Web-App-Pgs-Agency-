-- ============================================================
-- Migration: Release Database Performance Hardening
-- Timestamp: 20260820135000_release_db_performance_hardening.sql
-- Description: Drop redundant duplicate indexes and verify FK indexing
-- ============================================================

-- employee_profiles: drop duplicate btree indexes covered by unique constraint or composite index
DROP INDEX IF EXISTS public.emp_code_idx;
DROP INDEX IF EXISTS public.emp_reports_idx;
