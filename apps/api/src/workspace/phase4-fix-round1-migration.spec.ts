import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);
const phase3Migration = readFileSync(
  resolve(
    migrationsDirectory,
    '20260811143000_phase3_projects_services_tasks.sql',
  ),
  'utf8',
);
const phase4Migration = readFileSync(
  resolve(migrationsDirectory, '20260811170000_phase4_project_workspace.sql'),
  'utf8',
);
const fixMigration = readFileSync(
  resolve(migrationsDirectory, '20260811180000_phase4_fix_round1.sql'),
  'utf8',
);

function functionBody(name: string, nextMarker: string): string {
  const start = fixMigration.indexOf(
    `CREATE OR REPLACE FUNCTION public.${name}`,
  );
  const end = fixMigration.indexOf(nextMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return fixMigration.slice(start, end);
}

function expectProjectLockBeforeRows(body: string): void {
  const projectRead = body.indexOf('SELECT t.project_id');
  const advisoryLock = body.indexOf('pg_advisory_xact_lock');
  const movedTaskLock = body.indexOf('SELECT * INTO v_task', advisoryLock);
  const deterministicBoardLock = body.indexOf(
    'ORDER BY t.status, t.sort_order, t.id',
    movedTaskLock,
  );
  const firstRowLock = body.indexOf('FOR UPDATE');

  expect(projectRead).toBeGreaterThanOrEqual(0);
  expect(projectRead).toBeLessThan(advisoryLock);
  expect(advisoryLock).toBeLessThan(movedTaskLock);
  expect(movedTaskLock).toBeLessThan(deterministicBoardLock);
  expect(firstRowLock).toBeGreaterThan(advisoryLock);
}

describe('Phase 4 Fix Round 1 migration contract', () => {
  it('serializes two board moves before either task row can be locked', () => {
    const moveBody = functionBody(
      'move_task_on_board',
      'CREATE OR REPLACE FUNCTION public.phase4_request_project_file_delete',
    );

    expectProjectLockBeforeRows(moveBody);
    expect(moveBody).toContain(
      'pg_advisory_xact_lock(hashtextextended(v_project_id::TEXT, 0))',
    );
  });

  it('uses the same project-first lock order for ordinary status movement', () => {
    const statusBody = functionBody(
      'phase4_change_task_status',
      'CREATE OR REPLACE FUNCTION public.move_task_on_board',
    );

    expectProjectLockBeforeRows(statusBody);
    expect(statusBody).toContain('SET status = p_target_status');
    expect(statusBody).toContain('sort_order = v_next_sort_order');
    expect(statusBody).toContain(
      "set_config('app.phase4_ordering_write', 'allowed', TRUE)",
    );
  });

  it('preserves unique board ordering during status changes and board moves', () => {
    expect(phase4Migration).toContain(
      'CREATE UNIQUE INDEX tasks_project_status_sort_unique_idx',
    );
    expect(fixMigration).toContain(
      "AND t.status IN ('todo', 'in_progress', 'review', 'done')",
    );
    expect(fixMigration).toContain('sort_order = -2147483648');
    expect(fixMigration).toContain('sort_order = v_index * 1000');
    expect(fixMigration).toContain('TASK_ORDERING_RPC_REQUIRED');
    expect(fixMigration).toContain(
      'CREATE TRIGGER trigger_phase4_guard_task_ordering_write',
    );
  });

  it('keeps the Phase 3 completed_at behavior for moved-to-done tasks', () => {
    expect(phase3Migration).toContain("NEW.status = 'done'");
    expect(phase3Migration).toContain('NEW.completed_at := NOW()');
    expect(fixMigration).not.toMatch(/completed_at\s*=\s*NULL/i);
  });

  it('adds a recoverable active/deleting file lifecycle', () => {
    expect(fixMigration).toContain(
      "ADD COLUMN delete_status TEXT NOT NULL DEFAULT 'active'",
    );
    expect(fixMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.phase4_request_project_file_delete',
    );
    expect(fixMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.phase4_restore_project_file_delete',
    );
    expect(fixMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.phase4_finalize_project_file_delete',
    );
    expect(fixMigration).toContain("AND delete_status = 'deleting'");
  });

  it('exposes all new mutation functions to service_role only', () => {
    for (const functionName of [
      'phase4_change_task_status',
      'phase4_request_project_file_delete',
      'phase4_restore_project_file_delete',
      'phase4_finalize_project_file_delete',
    ]) {
      expect(fixMigration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}[\\s\\S]+?FROM PUBLIC, anon, authenticated`,
        ),
      );
      expect(fixMigration).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}[\\s\\S]+?TO service_role`,
        ),
      );
    }
    expect(fixMigration).toMatch(/SECURITY INVOKER/g);
    expect(fixMigration).toContain('SET search_path = public, pg_temp');
  });
});
