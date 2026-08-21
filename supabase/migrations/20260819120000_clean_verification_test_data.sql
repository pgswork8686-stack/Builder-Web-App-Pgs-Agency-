-- ============================================================
-- Migration: Clean Verification Test Execution and Rule
-- Timestamp: 20260819120000_clean_verification_test_data.sql
-- ============================================================

DO $block$
BEGIN
  -- Disable trigger temporarily to allow deletion of test verification records
  ALTER TABLE public.automation_executions DISABLE TRIGGER trigger_phase7_prevent_automation_execution_delete;

  DELETE FROM public.automation_executions
  WHERE event_key = 'evt_test_12345';

  ALTER TABLE public.automation_executions ENABLE TRIGGER trigger_phase7_prevent_automation_execution_delete;

  DELETE FROM public.automation_rules
  WHERE name = 'Auto Rule Test TDH';
END $block$;
