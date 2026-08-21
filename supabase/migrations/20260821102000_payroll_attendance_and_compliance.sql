-- ============================================================
-- Migration: Payroll Attendance, Compliance & Bonus Audit Fields
-- Timestamp: 20260821102000_payroll_attendance_and_compliance.sql
-- Purpose:
--   1. Adds detailed attendance penalty and bonus audit fields to payslips.
--   2. Introduces monthly employee compliance and discipline reviews.
-- ============================================================

-- Add attendance metrics and penalty/bonus audit columns to payslips
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS attendance_penalty_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_bonus_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_occurrences INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_occurrences INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_bonus_eligible BOOLEAN NOT NULL DEFAULT false;

-- Create monthly payroll reviews table for discipline and early-leave compliance
CREATE TABLE IF NOT EXISTS public.employee_monthly_payroll_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$'),
  discipline_bonus_eligible BOOLEAN NOT NULL DEFAULT true,
  early_leave_makeup_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_monthly_payroll_reviews UNIQUE (user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reviews_period_user
  ON public.employee_monthly_payroll_reviews(period_month, user_id);

-- Enable RLS and lock down permissions to backend service_role only
ALTER TABLE public.employee_monthly_payroll_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_monthly_payroll_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.employee_monthly_payroll_reviews TO service_role;
