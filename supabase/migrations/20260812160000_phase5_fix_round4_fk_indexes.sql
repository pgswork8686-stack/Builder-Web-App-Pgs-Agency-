-- Migration: Phase 5 - Fix Round 4 (Foreign-key index hardening)
-- Timestamp: 20260812160000_phase5_fix_round4_fk_indexes.sql
--
-- PostgreSQL does not automatically index referencing foreign-key columns.
-- These indexes keep deletes/updates on parent rows and common joins predictable
-- as attendance and leave history grows.

CREATE INDEX IF NOT EXISTS attendance_adjustments_record_idx
  ON public.attendance_adjustments (attendance_record_id);

CREATE INDEX IF NOT EXISTS attendance_adjustments_requested_by_idx
  ON public.attendance_adjustments (requested_by);

CREATE INDEX IF NOT EXISTS attendance_adjustments_approved_by_idx
  ON public.attendance_adjustments (approved_by);

CREATE INDEX IF NOT EXISTS attendance_records_created_by_idx
  ON public.attendance_records (created_by);

CREATE INDEX IF NOT EXISTS attendance_records_updated_by_idx
  ON public.attendance_records (updated_by);

CREATE INDEX IF NOT EXISTS leave_balance_adjustments_balance_idx
  ON public.leave_balance_adjustments (leave_balance_id);

CREATE INDEX IF NOT EXISTS leave_balance_adjustments_actor_idx
  ON public.leave_balance_adjustments (actor_user_id);

CREATE INDEX IF NOT EXISTS leave_requests_leave_type_idx
  ON public.leave_requests (leave_type_id);

CREATE INDEX IF NOT EXISTS leave_requests_reviewer_idx
  ON public.leave_requests (reviewer_user_id);

CREATE INDEX IF NOT EXISTS leave_requests_cancelled_by_idx
  ON public.leave_requests (cancelled_by);
