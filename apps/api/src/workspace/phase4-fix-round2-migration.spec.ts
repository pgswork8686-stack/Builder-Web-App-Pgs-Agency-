import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(
  __dirname,
  '../../../../supabase/migrations',
);
const fix2Migration = readFileSync(
  resolve(migrationsDirectory, '20260812100000_phase4_fix_round2.sql'),
  'utf8',
);

function functionBody(
  name: string,
  content: string,
  nextMarker?: string,
): string {
  const start = content.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  if (nextMarker) {
    const end = content.indexOf(nextMarker, start);
    expect(end).toBeGreaterThan(start);
    return content.slice(start, end);
  }
  return content.slice(start);
}

function expectProjectLockBeforeRows(body: string): void {
  const projectRead = body.indexOf('SELECT t.project_id');
  const advisoryLock = body.indexOf('pg_advisory_xact_lock');
  const movedTaskLock = body.indexOf('SELECT * INTO v_task', advisoryLock);
  const deterministicBoardLock = body.indexOf('FOR UPDATE', movedTaskLock);
  const firstRowLock = body.indexOf('FOR UPDATE');

  expect(projectRead).toBeGreaterThanOrEqual(0);
  expect(projectRead).toBeLessThan(advisoryLock);
  expect(advisoryLock).toBeLessThan(movedTaskLock);
  expect(movedTaskLock).toBeLessThan(deterministicBoardLock);
  expect(firstRowLock).toBeGreaterThan(advisoryLock);
}

describe('Phase 4 Fix Round 2 migration contract', () => {
  it('defines phase4_update_task_atomic with project lock before rows', () => {
    const body = functionBody(
      'phase4_update_task_atomic',
      fix2Migration,
      'REVOKE ALL ON FUNCTION public.phase4_update_task_atomic',
    );
    expectProjectLockBeforeRows(body);
    expect(body).toContain(
      'pg_advisory_xact_lock(hashtextextended(v_project_id::TEXT, 0))',
    );
    expect(body).toContain('status = CASE WHEN p_set_status THEN p_status');
    expect(body).toContain('updated_by = p_actor_user_id');
    expect(body).toContain(
      "set_config('app.phase4_ordering_write', 'allowed', TRUE)",
    );
    expect(body).not.toContain('completed_at = NULL');
    expect(body).not.toContain('completed_at := NULL');
    expect(body).toContain('v_task.project_id IS DISTINCT FROM v_project_id');
  });

  it('exposes phase4_update_task_atomic to service_role only', () => {
    expect(fix2Migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.phase4_update_task_atomic[\s\S]+?FROM PUBLIC, anon, authenticated/,
    );
    expect(fix2Migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.phase4_update_task_atomic[\s\S]+?TO service_role/,
    );
    expect(fix2Migration).toMatch(/SECURITY INVOKER/);
    expect(fix2Migration).toContain('SET search_path = public, pg_temp');
  });
});
