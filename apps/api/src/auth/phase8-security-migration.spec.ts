import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 8 security migration', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '../../../../supabase/migrations/20260813070000_phase8_lockdown_security_definer_helpers.sql',
    ),
    'utf8',
  );

  it('removes SECURITY DEFINER helper execute access from browser roles', () => {
    [
      'check_client_membership_role',
      'check_employee_profile_role',
      'check_team_leader_role',
      'handle_new_user',
      'prevent_direct_role_status_update',
      'set_updated_at',
    ].forEach((functionName) => {
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public.${functionName}()`,
      );
    });
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.is_admin(UUID)');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
  });

  it('keeps profile self-read policy independent from is_admin', () => {
    expect(migration).toContain('CREATE POLICY "profiles_select_own_policy"');
    expect(migration).toContain('USING ((SELECT auth.uid()) = id)');
    expect(migration).not.toContain('public.is_admin(auth.uid())');
  });

  it('keeps approval audit events Nest-only', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "account_approval_events_admin_select"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "account_approval_events_admin_insert"',
    );
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.account_approval_events',
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_approval_events',
    );
  });
});
