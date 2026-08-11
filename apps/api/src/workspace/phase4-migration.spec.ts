import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260811170000_phase4_project_workspace.sql',
  ),
  'utf8',
);

describe('Phase 4 migration security contract', () => {
  it('creates comments, files and expiring upload sessions with RLS', () => {
    expect(migration).toContain('CREATE TABLE public.task_comments');
    expect(migration).toContain('CREATE TABLE public.project_files');
    expect(migration).toContain('CREATE TABLE public.file_upload_sessions');
    expect(migration).toContain(
      'ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).toContain(
      'ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY',
    );
  });

  it('keeps browser roles off business tables and functions', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).not.toMatch(/CREATE POLICY/i);
  });

  it('creates only a private constrained storage bucket', () => {
    expect(migration).toContain("'project-files'");
    expect(migration).toContain('FALSE');
    expect(migration).toContain('26214400');
    expect(migration).not.toMatch(/public\s*=\s*true/i);
  });

  it('enforces project-task file consistency in the database', () => {
    expect(migration).toContain('phase4_validate_file_task_project');
    expect(migration).toContain('FILE_TASK_PROJECT_MISMATCH');
    expect(migration).toContain('trigger_phase4_validate_project_file_task');
  });

  it('serializes board moves and exposes the RPC to service_role only', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.move_task_on_board',
    );
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('tasks_project_status_sort_unique_idx');
  });
});
