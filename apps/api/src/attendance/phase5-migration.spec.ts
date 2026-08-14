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
const m15 = readFileSync(
  resolve(migrationsDirectory, '20260812150000_phase5_fix_round3.sql'),
  'utf8',
);
const m16 = readFileSync(
  resolve(
    migrationsDirectory,
    '20260812160000_phase5_fix_round4_fk_indexes.sql',
  ),
  'utf8',
);

const fullMigrationChain =
  m12 + '\n' + m13 + '\n' + m14 + '\n' + m15 + '\n' + m16;

describe('Phase 5 Attendance and Leave migration contract (Fix Round 2 + 3)', () => {
  it('defines attendance_records with proper constraints and unique idx', () => {
    expect(fullMigrationChain).toContain(
      'CREATE TABLE public.attendance_records',
    );
    expect(fullMigrationChain).toContain('UNIQUE(user_id, attendance_date)');
    expect(fullMigrationChain).toContain('check_checkout_after_checkin');
  });

  it('defines leave tables and review request atomic transaction RPC', () => {
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_types');
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_balances');
    expect(fullMigrationChain).toContain('CREATE TABLE public.leave_requests');
    expect(fullMigrationChain).toContain('phase5_review_leave_request');
  });

  it('verifies migration 140000 includes strict security and config cleanup details', () => {
    expect(m14).toContain('UPDATE public.attendance_settings');
    expect(m14).toContain('workday_start_time = NULL');
    expect(m14).toContain('attendance-evidence');
    expect(m14).toContain('5242880');
    expect(m14).toContain('consumed_at');
    expect(m14).toContain('check_bucket_evidence');
    expect(m14).toContain('check_allowed_mimes');
    expect(m14).toContain('consumed_at IS NOT NULL');
    expect(fullMigrationChain).toContain('SECURITY INVOKER');
    expect(fullMigrationChain).toContain('search_path = public, pg_temp');
  });

  // ============================================================
  // Fix Round 3 migration contract assertions (T17–T20)
  // ============================================================

  it('T17: drops obsolete checkout RPC overload (12-arg, no session_id)', () => {
    expect(m15).toContain(
      'DROP FUNCTION IF EXISTS public.phase5_check_out_attendance',
    );
    // The old 12-arg signature had no UUID at end (no photo_session_id)
    expect(m15).toContain(
      'DROP FUNCTION IF EXISTS public.phase5_check_out_attendance(\n  UUID, DATE, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,\n  TEXT, TEXT, public.attendance_status, INTEGER, INTEGER, INTEGER\n)',
    );
  });

  it('T18: drops obsolete adjust RPC overload (10-arg, no p_set_* flags)', () => {
    expect(m15).toContain(
      'DROP FUNCTION IF EXISTS public.phase5_adjust_attendance_record',
    );
    expect(m15).toContain(
      'DROP FUNCTION IF EXISTS public.phase5_adjust_attendance_record(\n  UUID, UUID, UUID,\n  TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status,\n  INTEGER, INTEGER, INTEGER, TEXT\n)',
    );
  });

  it('T19: final check-in RPC signature does NOT include p_photo_path as a parameter', () => {
    // Extract only the CREATE FUNCTION block for check_in from SECTION 3
    const section3 = m15.split('SECTION 3')[1]?.split('SECTION 4')[0] || '';
    // The function parameters section is between the opening ( and the first )
    const paramBlock =
      section3.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\)\s*RETURNS/)?.[0] ||
      '';
    // p_photo_path must NOT appear as a declared function parameter
    expect(paramBlock).not.toContain('p_photo_path');
    // But internal variable v_photo_path is ok — just not the parameter
    expect(section3).toContain('v_photo_path');
  });

  it('T19b: final check-out RPC signature does NOT include p_photo_path as a parameter', () => {
    const section4 = m15.split('SECTION 4')[1]?.split('SECTION 5')[0] || '';
    const paramBlock =
      section4.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\)\s*RETURNS/)?.[0] ||
      '';
    expect(paramBlock).not.toContain('p_photo_path');
    expect(section4).toContain('v_photo_path');
  });

  it('T20: service_role-only execute grants on final RPCs in round 3', () => {
    expect(m15).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase5_check_in_attendance',
    );
    expect(m15).toContain(
      'GRANT EXECUTE ON FUNCTION public.phase5_check_out_attendance',
    );
    expect(m15).toContain('TO service_role');
    expect(m15).toContain(
      'REVOKE ALL ON FUNCTION public.phase5_check_in_attendance',
    );
    expect(m15).toContain(
      'REVOKE ALL ON FUNCTION public.phase5_check_out_attendance',
    );
    expect(m15).not.toMatch(/GRANT EXECUTE[\s\S]*?TO (?:anon|authenticated)/);
  });

  it('T20b: hardens session columns without hiding migration failures or fabricating sizes', () => {
    expect(m15).toContain('ALTER COLUMN expected_size SET NOT NULL');
    expect(m15).toContain('PHASE5_PHOTO_SESSION_INCOMPLETE_DATA');
    expect(m15).not.toContain('WHEN others THEN NULL');
    expect(m15).not.toContain('SET expected_size = 1');
  });

  it('T20c: final RPCs reject incomplete bindings and consume sessions atomically', () => {
    expect(m15).toContain(
      "v_session.storage_bucket IS DISTINCT FROM 'attendance-evidence'",
    );
    expect(m15).toContain("RAISE EXCEPTION 'ATTENDANCE_PHOTO_MISMATCH'");
    expect(m15).toContain('AND consumed_at IS NULL');
  });

  it('T7b: consumed_at semantic comment documents canonical usage', () => {
    expect(m15).toContain(
      'COMMENT ON COLUMN public.attendance_photo_upload_sessions.consumed_at',
    );
    expect(m15).toContain(
      'COMMENT ON COLUMN public.attendance_photo_upload_sessions.completed_at',
    );
    expect(m15).toContain('LEGACY');
  });

  it('covers every Phase 5 foreign key reported by the database advisor', () => {
    const indexedColumns = [
      'attendance_record_id',
      'requested_by',
      'approved_by',
      'created_by',
      'updated_by',
      'leave_balance_id',
      'actor_user_id',
      'leave_type_id',
      'reviewer_user_id',
      'cancelled_by',
    ];

    for (const column of indexedColumns) {
      expect(m16).toContain(`(${column})`);
    }
  });
});
