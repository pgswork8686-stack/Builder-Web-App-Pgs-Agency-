import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);
const phase5Migration = readFileSync(
  resolve(migrationsDirectory, '20260812120000_phase5_attendance_leave.sql'),
  'utf8',
);

describe('Phase 5 Attendance and Leave migration contract', () => {
  it('defines attendance_records with proper constraints and unique idx', () => {
    expect(phase5Migration).toContain('CREATE TABLE public.attendance_records');
    expect(phase5Migration).toContain('UNIQUE(user_id, attendance_date)');
    expect(phase5Migration).toContain('check_checkout_after_checkin');
    expect(phase5Migration).toContain('check_late_minutes_nonnegative');
    expect(phase5Migration).toContain('check_early_leave_minutes_nonnegative');
    expect(phase5Migration).toContain('check_work_minutes_nonnegative');
  });

  it('defines leave tables and review request atomic transaction RPC', () => {
    expect(phase5Migration).toContain('CREATE TABLE public.leave_types');
    expect(phase5Migration).toContain('CREATE TABLE public.leave_balances');
    expect(phase5Migration).toContain('CREATE TABLE public.leave_requests');
    expect(phase5Migration).toContain('phase5_review_leave_request');
    expect(phase5Migration).toContain(
      'allocated_days + adjusted_days - used_days >= 0',
    );
    expect(phase5Migration).toContain('FOR UPDATE');
  });

  it('restricts public access and locks database down via RLS & service_role', () => {
    expect(phase5Migration).toContain(
      'ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;',
    );
    expect(phase5Migration).toContain(
      'ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;',
    );
    expect(phase5Migration).toContain(
      'REVOKE ALL ON public.attendance_records FROM PUBLIC, anon, authenticated;',
    );
    expect(phase5Migration).toContain(
      'GRANT ALL ON public.attendance_records TO service_role;',
    );
    expect(phase5Migration).toContain(
      'REVOKE ALL ON FUNCTION public.phase5_review_leave_request',
    );
    expect(phase5Migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase5_review_leave_request',
    );
  });

  it('defines performance indexes for directory listings and calendars', () => {
    expect(phase5Migration).toContain(
      'CREATE INDEX IF NOT EXISTS attendance_records_user_date_idx',
    );
    expect(phase5Migration).toContain(
      'CREATE INDEX IF NOT EXISTS leave_requests_user_created_idx',
    );
    expect(phase5Migration).toContain(
      'CREATE INDEX IF NOT EXISTS leave_balances_user_year_idx',
    );
  });
});
