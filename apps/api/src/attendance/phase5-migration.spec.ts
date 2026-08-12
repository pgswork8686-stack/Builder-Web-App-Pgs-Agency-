import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);

const m12 = readFileSync(
  resolve(migrationsDirectory, '20260812120000_phase5_attendance_leave.sql'),
  'utf8',
);
const m13 = readFileSync(
  resolve(migrationsDirectory, '20260812130000_phase5_fix_round1.sql'),
  'utf8',
);
const m14 = readFileSync(
  resolve(migrationsDirectory, '20260812140000_phase5_fix_round2.sql'),
  'utf8',
);

const fullMigrationChain = m12 + '\n' + m13 + '\n' + m14;

describe('Phase 5 Attendance and Leave migration contract (Fix Round 2)', () => {
  it('defines attendance_records with proper constraints and unique idx', () => {
    expect(fullMigrationChain).toContain('CREATE TABLE public.attendance_records');
    expect(fullMigrationChain).toContain('UNIQUE(user_id, attendance_date)');
    expect(fullMigrationChain).toContain('check_checkout_after_checkin');
  });

  it('defines leave tables and review request atomic transaction RPC', () => {
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_types');
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_balances');
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_requests');
    expect(fullMigrationChain).toContain('phase5_review_leave_request');
  });

  it('verifies final migration chain includes strict security and config cleanup details', () => {
    // 1. Existing seeded attendance settings become unconfigured
    expect(m14).toContain('UPDATE public.attendance_settings');
    expect(m14).toContain('workday_start_time = NULL');

    // 2. Private attendance-evidence bucket with 5MB & MIME limit
    expect(m14).toContain('attendance-evidence');
    expect(m14).toContain('5242880'); // 5 MB

    // 3. Photo session constraints & one-time session consumption path
    expect(m14).toContain('consumed_at');
    expect(m14).toContain('check_bucket_evidence');
    expect(m14).toContain('check_allowed_mimes');
    expect(m14).toContain('consumed_at IS NOT NULL');

    // 4. Invoker search path security check
    expect(fullMigrationChain).toContain('SECURITY INVOKER');
    expect(fullMigrationChain).toContain('search_path = public, pg_temp');
  });
});
