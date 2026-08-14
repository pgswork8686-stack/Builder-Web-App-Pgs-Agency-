import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 8 FK index hardening migration', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '../../../../supabase/migrations/20260813071000_phase8_fk_index_hardening.sql',
    ),
    'utf8',
  );

  it('adds indexes for advisor-reported historical foreign keys', () => {
    [
      'client_companies_created_by_idx',
      'client_companies_updated_by_idx',
      'client_memberships_created_by_idx',
      'departments_created_by_idx',
      'departments_updated_by_idx',
      'employee_profiles_created_by_idx',
      'employee_profiles_updated_by_idx',
      'profiles_approved_by_idx',
      'profiles_rejected_by_idx',
      'project_memberships_created_by_idx',
      'project_services_created_by_idx',
      'project_services_updated_by_idx',
      'projects_created_by_idx',
      'projects_updated_by_idx',
      'services_created_by_idx',
      'services_updated_by_idx',
      'tasks_created_by_idx',
      'tasks_reporter_user_id_idx',
      'tasks_updated_by_idx',
      'teams_created_by_idx',
      'teams_updated_by_idx',
    ].forEach((indexName) => {
      expect(migration).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
    });
  });

  it('is additive and does not drop existing indexes', () => {
    expect(migration).not.toMatch(/\bDROP\s+INDEX\b/i);
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
  });
});
