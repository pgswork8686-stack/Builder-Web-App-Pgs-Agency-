import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../../supabase/migrations/20260820124000_workflow_engine_v1_runtime_hardening.sql',
);
const automationFoundationPath = resolve(
  __dirname,
  '../../../../supabase/migrations/20260812200000_phase7_notifications_chat_automation.sql',
);
const workflowHardeningPath = resolve(
  __dirname,
  '../../../../supabase/migrations/20260820123000_workflow_engine_v1_hardening.sql',
);

function extractFunction(sql: string, functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`;
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`Missing SQL function: ${functionName}`);

  const end = sql.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`Unterminated SQL function: ${functionName}`);
  return sql.slice(start, end + '\n$$;'.length);
}

function expectFragmentsInOrder(sql: string, fragments: string[]): void {
  let cursor = -1;
  for (const fragment of fragments) {
    const index = sql.indexOf(fragment, cursor + 1);
    expect(index).toBeGreaterThan(cursor);
    cursor = index;
  }
}

function expectServiceRoleOnlyRpc(
  sql: string,
  functionName: string,
  signature: string,
): void {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(sql).toMatch(
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${functionName}\\(${escapedSignature}\\)\\s+FROM PUBLIC, anon, authenticated;\\s+GRANT EXECUTE ON FUNCTION public\\.${functionName}\\(${escapedSignature}\\)\\s+TO service_role;`,
    ),
  );
}

describe('Workflow Engine V1 runtime hardening migration contract', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it('exists as a source-only migration', () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain('SOURCE ONLY');
    expect(migration).toContain('must not be applied to Production');
  });

  it('keeps the earlier atomic create RPC syntactically delimited', () => {
    const workflowHardening = readFileSync(workflowHardeningPath, 'utf8');
    expect(workflowHardening).toMatch(
      /workflow_create_template[\s\S]+SET search_path = public, pg_temp\s+AS \$\$[\s\S]+END;\s+\$\$;/,
    );

    const createTemplate = extractFunction(
      workflowHardening,
      'workflow_create_template',
    );
    expectFragmentsInOrder(createTemplate, [
      'FROM public.services',
      'FOR UPDATE;',
      'SELECT COALESCE(MAX(version), 0) + 1',
      'INSERT INTO public.workflow_templates',
    ]);
    expect(createTemplate).toContain('SECURITY INVOKER');
    expect(createTemplate).toContain('SET search_path = public, pg_temp');
    expectServiceRoleOnlyRpc(
      workflowHardening,
      'workflow_create_template',
      'UUID, TEXT, TEXT, UUID',
    );
  });

  it('defines atomic clone, default selection, and instantiation RPCs', () => {
    for (const fn of [
      'workflow_clone_template',
      'workflow_set_default_template',
      'workflow_instantiate_project_service',
    ]) {
      expect(migration).toContain(`FUNCTION public.${fn}`);
      expect(migration).toContain('SECURITY INVOKER');
      expect(migration).toContain('SET search_path = public, pg_temp');
    }

    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('WORKFLOW_SNAPSHOT_INCONSISTENT');
    expect(migration).toContain("'no_default_workflow'");
    expect(migration).toContain('array_position(v_old_stage_ids');
    expect(migration).toContain('array_position(v_old_item_ids');
  });

  it('orders graph locks and writes for atomic clone, default, and snapshot RPCs', () => {
    const clone = extractFunction(migration, 'workflow_clone_template');
    expectFragmentsInOrder(clone, [
      'PERFORM 1 FROM public.services',
      'FOR UPDATE;',
      'SELECT * INTO v_source',
      'FOR SHARE;',
      'LOCK TABLE public.workflow_template_stages IN SHARE MODE;',
      'LOCK TABLE public.workflow_template_stage_items IN SHARE MODE;',
      'LOCK TABLE public.workflow_template_stage_dependencies IN SHARE MODE;',
      'LOCK TABLE public.workflow_template_item_dependencies IN SHARE MODE;',
      'SELECT COALESCE(MAX(version), 0) + 1',
      'INSERT INTO public.workflow_templates',
      'INSERT INTO public.workflow_template_stages',
      'INSERT INTO public.workflow_template_stage_items',
      'INSERT INTO public.workflow_template_stage_dependencies',
      'INSERT INTO public.workflow_template_item_dependencies',
    ]);

    const setDefault = extractFunction(
      migration,
      'workflow_set_default_template',
    );
    expectFragmentsInOrder(setDefault, [
      'PERFORM 1 FROM public.services',
      'FOR UPDATE;',
      'SELECT status INTO v_status',
      'FOR UPDATE;',
      'SET is_default = false',
      'SET is_default = true',
    ]);

    const instantiate = extractFunction(
      migration,
      'workflow_instantiate_project_service',
    );
    expectFragmentsInOrder(instantiate, [
      'FOR UPDATE OF ps;',
      'FROM public.project_workflows',
      'PERFORM 1 FROM public.services',
      'FOR SHARE;',
      'FROM public.workflow_templates',
      'FOR SHARE;',
      'INSERT INTO public.project_workflows',
      'INSERT INTO public.project_workflow_stages',
      'INSERT INTO public.project_workflow_stage_items',
      'INSERT INTO public.project_workflow_stage_dependencies',
      'INSERT INTO public.project_workflow_item_dependencies',
      'INSERT INTO public.workflow_audit_events',
    ]);

    for (const [name, signature] of [
      ['workflow_clone_template', 'UUID, UUID'],
      ['workflow_set_default_template', 'UUID, UUID'],
      ['workflow_instantiate_project_service', 'UUID, UUID, UUID'],
    ]) {
      expectServiceRoleOnlyRpc(migration, name, signature);
    }
  });

  it('snapshots exact runtime columns and both dependency DAGs', () => {
    for (const column of [
      'source_workflow_template_id',
      'source_workflow_version',
      'source_template_stage_id',
      'source_template_stage_item_id',
      'project_service_item_id',
      'sla_hours_snapshot',
      'completion_mode',
      'auto_create_task',
    ]) {
      expect(migration).toContain(column);
    }

    expect(migration).toContain(
      'INSERT INTO public.project_workflow_stage_dependencies',
    );
    expect(migration).toContain(
      'INSERT INTO public.project_workflow_item_dependencies',
    );
  });

  it('enforces task, approval, SLA, lag, and target invariants in PostgreSQL', () => {
    for (const invariant of [
      'uidx_project_workflow_task_links_primary',
      'uidx_workflow_approval_pending_item',
      'uidx_workflow_approval_pending_stage',
      'uidx_project_service_items_delivery_source',
      'workflow_template_stages_sla_positive',
      'workflow_template_stage_items_sla_positive',
      'workflow_template_stage_dependencies_lag_nonnegative',
      'workflow_template_item_dependencies_lag_nonnegative',
      'project_workflow_stage_dependencies_lag_nonnegative',
      'project_workflow_item_dependencies_lag_nonnegative',
      'workflow_approval_requests_exactly_one_target',
    ]) {
      expect(migration).toContain(invariant);
    }

    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_service_items_delivery_source\s+ON public\.project_service_items \(project_service_id, source_delivery_item_id\)\s+WHERE source_delivery_item_id IS NOT NULL;/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_workflow_task_links_primary\s+ON public\.project_workflow_task_links \(project_workflow_stage_item_id\)\s+WHERE link_type = 'primary';/,
    );
  });

  it('atomically creates one primary link to the existing Task entity', () => {
    const createPrimaryTask = extractFunction(
      migration,
      'workflow_create_primary_task',
    );

    expect(createPrimaryTask).toContain('RETURNS JSONB');
    expect(createPrimaryTask).toContain('WORKFLOW_TASK_ITEM_MISMATCH');
    expect(createPrimaryTask).toContain('w.project_id = p_project_id');
    expect(createPrimaryTask).toContain(
      'i.project_service_item_id = p_project_service_item_id',
    );
    expect(createPrimaryTask).toMatch(
      /assignee_user_id,\s+reporter_user_id,[\s\S]+?'todo',\s+'medium',\s+NULL,\s+p_actor_id,/,
    );
    expect(createPrimaryTask).toContain("'primary'");
    expect(createPrimaryTask).toContain('created_by_workflow');
    expect(createPrimaryTask).toContain(
      "jsonb_build_object('workflowLinkExisting', true)",
    );
    expect(createPrimaryTask).toContain(
      "jsonb_build_object('workflowLinkExisting', false)",
    );
    expect(createPrimaryTask).not.toContain('workflow_tasks');
    expect(createPrimaryTask).not.toMatch(/\b(COMMIT|ROLLBACK)\b/i);
    expectFragmentsInOrder(createPrimaryTask, [
      'FOR UPDATE OF i;',
      'FROM public.project_workflow_task_links l',
      'INSERT INTO public.tasks',
      'INSERT INTO public.project_workflow_task_links',
    ]);
    expectServiceRoleOnlyRpc(
      migration,
      'workflow_create_primary_task',
      'UUID, UUID, UUID, TEXT, UUID',
    );
  });

  it('keeps approval request and response state changes inside atomic RPCs', () => {
    const requestApproval = extractFunction(
      migration,
      'workflow_request_approval',
    );
    expect(requestApproval).toContain(
      'RETURNS public.workflow_approval_requests',
    );
    expect(requestApproval).toContain('WORKFLOW_APPROVAL_TARGET_INVALID');
    expect(requestApproval).toContain('WORKFLOW_APPROVAL_TYPE_INVALID');
    expect(requestApproval).toContain('p_approval_type IS NULL');
    expect(requestApproval).toContain(
      'WORKFLOW_APPROVAL_CONFIGURATION_INVALID',
    );
    expect(requestApproval).toContain('(p_stage_item_id IS NOT NULL)::integer');
    expect(requestApproval).toContain('(p_stage_id IS NOT NULL)::integer <> 1');
    expect(requestApproval).toContain('i.project_workflow_id = p_workflow_id');
    expect(requestApproval).toContain('w.project_id = p_project_id');
    expectFragmentsInOrder(requestApproval, [
      'FOR UPDATE OF w;',
      'FOR UPDATE OF s, i;',
      'FOR UPDATE OF s;',
      'INSERT INTO public.workflow_approval_requests',
      'UPDATE public.project_workflow_stage_items',
      "SET status = 'pending_approval'",
    ]);
    expect(requestApproval).not.toMatch(/\b(COMMIT|ROLLBACK)\b/i);

    const respondApproval = extractFunction(
      migration,
      'workflow_respond_approval',
    );
    expect(respondApproval).toContain(
      'RETURNS public.workflow_approval_requests',
    );
    expect(respondApproval).toContain('WORKFLOW_APPROVAL_DECISION_INVALID');
    expect(respondApproval).toContain('p_decision IS NULL');
    expect(respondApproval).toContain('WORKFLOW_APPROVAL_ALREADY_RESPONDED');
    expect(respondApproval).toContain('a.project_id = p_project_id');
    expect(respondApproval).toContain('a.project_workflow_id = p_workflow_id');
    expect(respondApproval).toContain('approver_user_id = p_actor_id');
    expect(respondApproval).toContain('responded_at = now()');
    expect(respondApproval).toContain('decision_note = p_decision_note');
    expectFragmentsInOrder(respondApproval, [
      'FOR UPDATE OF w;',
      'FOR UPDATE OF s, i;',
      'FOR UPDATE OF s;',
      'FOR UPDATE OF a;',
      "IF v_approval.status <> 'pending'",
      'UPDATE public.workflow_approval_requests',
      'UPDATE public.project_workflow_stage_items i',
    ]);
    expect(respondApproval).not.toMatch(/\b(COMMIT|ROLLBACK)\b/i);

    expect(migration).toContain(
      'completion intentionally remains in the runtime reconciliation path',
    );

    expectServiceRoleOnlyRpc(
      migration,
      'workflow_request_approval',
      'UUID, UUID, UUID, UUID, TEXT, TEXT, UUID',
    );
    expectServiceRoleOnlyRpc(
      migration,
      'workflow_respond_approval',
      'UUID, UUID, UUID, TEXT, TEXT, UUID',
    );
  });

  it('grants every Workflow business-code sequence only to the backend role', () => {
    for (const sequence of [
      'seq_workflow_template_code',
      'seq_workflow_stage_code',
      'seq_project_workflow_code',
      'seq_project_workflow_stage_code',
    ]) {
      expect(migration).toContain(
        `GRANT USAGE, SELECT ON SEQUENCE public.${sequence} TO service_role;`,
      );
    }
  });

  it('adds the workflow events without weakening existing automation actions', () => {
    for (const event of [
      'workflow.started',
      'workflow.stage.started',
      'workflow.stage.completed',
      'workflow.item.completed',
      'workflow.approval.requested',
      'workflow.approval.approved',
      'workflow.approval.rejected',
    ]) {
      expect(migration).toContain(`'${event}'`);
    }

    const automationFoundation = readFileSync(automationFoundationPath, 'utf8');
    expect(automationFoundation).toContain(
      "action_type IN ('create_notification')",
    );
    expect(migration).not.toMatch(
      /DROP CONSTRAINT IF EXISTS automation_rules_action/i,
    );
  });

  it('keeps every workflow table backend-only with explicit grants', () => {
    const tables = [
      'workflow_templates',
      'workflow_template_stages',
      'workflow_template_stage_items',
      'workflow_template_stage_dependencies',
      'workflow_template_item_dependencies',
      'project_workflows',
      'project_workflow_stages',
      'project_workflow_stage_items',
      'project_workflow_stage_dependencies',
      'project_workflow_item_dependencies',
      'project_workflow_task_links',
      'workflow_approval_requests',
      'workflow_audit_events',
    ];

    for (const table of tables) {
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
      expect(migration).toContain(
        `REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated;`,
      );
      expect(migration).toContain(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO service_role;`,
      );
    }
  });

  it('adds indexes for runtime joins, unlocks, approvals, and audit history', () => {
    for (const index of [
      'idx_workflow_template_stage_deps_template_successor',
      'idx_workflow_template_item_deps_template_successor',
      'idx_project_workflows_project',
      'idx_project_workflow_stages_workflow',
      'idx_project_workflow_items_stage',
      'idx_project_workflow_stage_deps_workflow_successor',
      'idx_project_workflow_item_deps_workflow_successor',
      'idx_workflow_approvals_project_status',
      'idx_workflow_audit_workflow_created',
    ]) {
      expect(migration).toContain(index);
    }
  });
});
