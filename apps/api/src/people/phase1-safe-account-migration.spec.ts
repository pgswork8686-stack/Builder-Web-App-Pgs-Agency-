import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260826032457_phase1_safe_account_lifecycle.sql',
  ),
  'utf8',
);

function functionBody(name: string, nextMarker: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = migration.indexOf(nextMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe('Phase 1 safe account lifecycle migration', () => {
  it('terminates access atomically without deleting identity or business history', () => {
    const body = functionBody(
      'phase1_terminate_account',
      'CREATE OR REPLACE FUNCTION public.phase1_replace_user_project_memberships',
    );

    expect(body).toContain('FOR UPDATE');
    expect(body).toContain("account_status = 'rejected'");
    expect(body).toContain("employment_status = 'terminated'");
    expect(body).toContain('UPDATE public.user_role_assignments');
    expect(body).toContain('INSERT INTO public.account_approval_events');
    expect(body).toContain('ACCOUNT_TERMINATION_LAST_ADMIN_DENIED');
    expect(body).not.toContain('DELETE FROM public.profiles');
    expect(body).not.toContain('DELETE FROM public.employee_profiles');
    expect(body).not.toContain('DELETE FROM public.attendance_records');
    expect(body).not.toContain('DELETE FROM public.leave_requests');
    expect(body).not.toContain('DELETE FROM public.project_memberships');
    expect(body).not.toContain('DELETE FROM public.client_memberships');
  });

  it('replaces project assignments as one database transaction', () => {
    const body = functionBody(
      'phase1_replace_user_project_memberships',
      'REVOKE ALL ON FUNCTION public.phase1_terminate_account',
    );

    expect(body).toContain('PROJECT_ASSIGNMENT_PROJECT_NOT_FOUND');
    expect(body).toContain('PROJECT_MANAGER_MEMBERSHIP_REQUIRED');
    expect(body).toContain('DELETE FROM public.project_memberships');
    expect(body).toContain('ON CONFLICT (project_id, user_id) DO UPDATE');
  });

  it('exposes lifecycle RPCs only to service_role and revokes broad table grants', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.phase1_terminate_account[\s\S]+?FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.phase1_terminate_account[\s\S]+?TO service_role/,
    );
    expect(migration).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE\n  public.client_companies',
    );
    expect(migration).toContain(
      'GRANT SELECT ON TABLE public.profiles TO authenticated;',
    );
  });
});
