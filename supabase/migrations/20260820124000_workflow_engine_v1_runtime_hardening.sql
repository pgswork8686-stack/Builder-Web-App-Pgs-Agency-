-- ============================================================
-- Workflow Engine V1 - runtime hardening (SOURCE ONLY)
-- This migration must not be applied to Production by this task.
-- ============================================================

-- Backend RPCs and business-code defaults need explicit sequence access.
GRANT USAGE, SELECT ON SEQUENCE public.seq_workflow_template_code TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_workflow_stage_code TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_project_workflow_code TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_project_workflow_stage_code TO service_role;

-- One primary task and one active approval per target are concurrency guards,
-- not application conventions.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_workflow_task_links_primary
  ON public.project_workflow_task_links (project_workflow_stage_item_id)
  WHERE link_type = 'primary';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_approval_pending_item
  ON public.workflow_approval_requests (
    project_workflow_stage_item_id,
    approval_type
  )
  WHERE status = 'pending' AND project_workflow_stage_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_approval_pending_stage
  ON public.workflow_approval_requests (
    project_workflow_stage_id,
    approval_type
  )
  WHERE status = 'pending' AND project_workflow_stage_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_service_items_delivery_source
  ON public.project_service_items (project_service_id, source_delivery_item_id)
  WHERE source_delivery_item_id IS NOT NULL;

-- Foreign-key and runtime lookup indexes used by template validation, DAG unlocks,
-- project authorization, approval queues, and audit history.
CREATE INDEX IF NOT EXISTS idx_workflow_template_stage_items_stage
  ON public.workflow_template_stage_items (workflow_template_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_stage_items_delivery_item
  ON public.workflow_template_stage_items (service_delivery_item_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_stage_deps_template_successor
  ON public.workflow_template_stage_dependencies (workflow_template_id, successor_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_template_item_deps_template_successor
  ON public.workflow_template_item_dependencies (workflow_template_id, successor_stage_item_id);
CREATE INDEX IF NOT EXISTS idx_project_workflows_project
  ON public.project_workflows (project_id);
CREATE INDEX IF NOT EXISTS idx_project_workflows_source_template
  ON public.project_workflows (source_workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_stages_workflow
  ON public.project_workflow_stages (project_workflow_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_workflow_stages_source
  ON public.project_workflow_stages (source_template_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_items_workflow
  ON public.project_workflow_stage_items (project_workflow_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_items_stage
  ON public.project_workflow_stage_items (project_workflow_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_items_source
  ON public.project_workflow_stage_items (source_template_stage_item_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_task_links_task
  ON public.project_workflow_task_links (task_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_stage_deps_workflow_successor
  ON public.project_workflow_stage_dependencies (project_workflow_id, successor_stage_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_item_deps_workflow_successor
  ON public.project_workflow_item_dependencies (project_workflow_id, successor_stage_item_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_project_status
  ON public.workflow_approval_requests (project_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow
  ON public.workflow_approval_requests (project_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_stage
  ON public.workflow_approval_requests (project_workflow_stage_id)
  WHERE project_workflow_stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_item
  ON public.workflow_approval_requests (project_workflow_stage_item_id)
  WHERE project_workflow_stage_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver
  ON public.workflow_approval_requests (approver_user_id)
  WHERE approver_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_requester
  ON public.workflow_approval_requests (requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_project_created
  ON public.workflow_audit_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_workflow_created
  ON public.workflow_audit_events (project_workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_actor
  ON public.workflow_audit_events (actor_user_id)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_audit_entity
  ON public.workflow_audit_events (entity_type, entity_id, created_at DESC);

-- Add hard checks without rewriting either earlier Workflow migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_template_stages_sla_positive'
      AND conrelid = 'public.workflow_template_stages'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_stages
      ADD CONSTRAINT workflow_template_stages_sla_positive
      CHECK (sla_hours IS NULL OR sla_hours > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_template_stage_items_sla_positive'
      AND conrelid = 'public.workflow_template_stage_items'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_stage_items
      ADD CONSTRAINT workflow_template_stage_items_sla_positive
      CHECK (sla_hours IS NULL OR sla_hours > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_template_stage_items_approval_consistent'
      AND conrelid = 'public.workflow_template_stage_items'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_stage_items
      ADD CONSTRAINT workflow_template_stage_items_approval_consistent
          CHECK (
            (completion_mode <> 'tasks_done_and_approval' OR approval_required)
            AND (
              NOT approval_required
              OR (
                approval_scope IS NOT NULL
                AND approval_scope IN ('internal', 'client', 'both')
              )
            )
          );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_template_stage_dependencies_lag_nonnegative'
      AND conrelid = 'public.workflow_template_stage_dependencies'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_stage_dependencies
      ADD CONSTRAINT workflow_template_stage_dependencies_lag_nonnegative
      CHECK (lag_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_template_item_dependencies_lag_nonnegative'
      AND conrelid = 'public.workflow_template_item_dependencies'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_item_dependencies
      ADD CONSTRAINT workflow_template_item_dependencies_lag_nonnegative
      CHECK (lag_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_stages_sla_positive'
      AND conrelid = 'public.project_workflow_stages'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_stages
      ADD CONSTRAINT project_workflow_stages_sla_positive
      CHECK (sla_hours_snapshot IS NULL OR sla_hours_snapshot > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_stage_items_sla_positive'
      AND conrelid = 'public.project_workflow_stage_items'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_stage_items
      ADD CONSTRAINT project_workflow_stage_items_sla_positive
      CHECK (sla_hours_snapshot IS NULL OR sla_hours_snapshot > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_stage_items_approval_consistent'
      AND conrelid = 'public.project_workflow_stage_items'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_stage_items
      ADD CONSTRAINT project_workflow_stage_items_approval_consistent
          CHECK (
            (completion_mode <> 'tasks_done_and_approval' OR approval_required)
            AND (
              NOT approval_required
              OR (
                approval_scope IS NOT NULL
                AND approval_scope IN ('internal', 'client', 'both')
              )
            )
          );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_stage_dependencies_lag_nonnegative'
      AND conrelid = 'public.project_workflow_stage_dependencies'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_stage_dependencies
      ADD CONSTRAINT project_workflow_stage_dependencies_lag_nonnegative
      CHECK (lag_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_workflow_item_dependencies_lag_nonnegative'
      AND conrelid = 'public.project_workflow_item_dependencies'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_item_dependencies
      ADD CONSTRAINT project_workflow_item_dependencies_lag_nonnegative
      CHECK (lag_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_approval_requests_exactly_one_target'
      AND conrelid = 'public.workflow_approval_requests'::regclass
  ) THEN
    ALTER TABLE public.workflow_approval_requests
      ADD CONSTRAINT workflow_approval_requests_exactly_one_target
      CHECK (
        (project_workflow_stage_id IS NOT NULL)::integer
        + (project_workflow_stage_item_id IS NOT NULL)::integer = 1
      );
  END IF;
END $$;

-- Keep updated_at trustworthy for every mutable Workflow row.
DROP TRIGGER IF EXISTS trigger_set_updated_at_workflow_templates ON public.workflow_templates;
CREATE TRIGGER trigger_set_updated_at_workflow_templates
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_workflow_template_stages ON public.workflow_template_stages;
CREATE TRIGGER trigger_set_updated_at_workflow_template_stages
  BEFORE UPDATE ON public.workflow_template_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_workflow_template_stage_items ON public.workflow_template_stage_items;
CREATE TRIGGER trigger_set_updated_at_workflow_template_stage_items
  BEFORE UPDATE ON public.workflow_template_stage_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_project_workflows ON public.project_workflows;
CREATE TRIGGER trigger_set_updated_at_project_workflows
  BEFORE UPDATE ON public.project_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_project_workflow_stages ON public.project_workflow_stages;
CREATE TRIGGER trigger_set_updated_at_project_workflow_stages
  BEFORE UPDATE ON public.project_workflow_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_project_workflow_stage_items ON public.project_workflow_stage_items;
CREATE TRIGGER trigger_set_updated_at_project_workflow_stage_items
  BEFORE UPDATE ON public.project_workflow_stage_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_workflow_approval_requests ON public.workflow_approval_requests;
CREATE TRIGGER trigger_set_updated_at_workflow_approval_requests
  BEFORE UPDATE ON public.workflow_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Retain every existing automation trigger and add Workflow events.
ALTER TABLE public.automation_rules
  DROP CONSTRAINT IF EXISTS automation_rules_trigger_valid;
ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_trigger_valid CHECK (
    trigger_type IN (
      'task.created', 'task.assigned', 'task.updated', 'task.due_soon',
      'project.updated', 'leave.submitted', 'leave.approved', 'leave.rejected',
      'attendance.adjustment_requested', 'contract.status_changed',
      'invoice.issued', 'invoice.overdue', 'invoice.payment_recorded',
      'chat.message', 'workflow.started', 'workflow.stage.ready',
      'workflow.stage.started', 'workflow.stage.completed',
      'workflow.item.ready', 'workflow.item.blocked', 'workflow.item.completed',
      'workflow.approval.requested', 'workflow.approval.approved',
      'workflow.approval.rejected', 'workflow.sla.due_soon',
      'workflow.sla.breached'
    )
  );

ALTER TABLE public.automation_executions
  DROP CONSTRAINT IF EXISTS automation_executions_trigger_valid;
ALTER TABLE public.automation_executions
  ADD CONSTRAINT automation_executions_trigger_valid CHECK (
    trigger_type IN (
      'task.created', 'task.assigned', 'task.updated', 'task.due_soon',
      'project.updated', 'leave.submitted', 'leave.approved', 'leave.rejected',
      'attendance.adjustment_requested', 'contract.status_changed',
      'invoice.issued', 'invoice.overdue', 'invoice.payment_recorded',
      'chat.message', 'workflow.started', 'workflow.stage.ready',
      'workflow.stage.started', 'workflow.stage.completed',
      'workflow.item.ready', 'workflow.item.blocked', 'workflow.item.completed',
      'workflow.approval.requested', 'workflow.approval.approved',
      'workflow.approval.rejected', 'workflow.sla.due_soon',
      'workflow.sla.breached'
    )
  );

-- Atomic graph clone. The service row is always the first write lock, which
-- serializes version allocation with workflow_create_template().
CREATE OR REPLACE FUNCTION public.workflow_clone_template(
  p_template_id UUID,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.workflow_templates;
  v_new_template_id UUID;
  v_next_version INTEGER;
  v_stage RECORD;
  v_item RECORD;
  v_dependency RECORD;
  v_old_stage_ids UUID[] := ARRAY[]::UUID[];
  v_new_stage_ids UUID[] := ARRAY[]::UUID[];
  v_old_item_ids UUID[] := ARRAY[]::UUID[];
  v_new_item_ids UUID[] := ARRAY[]::UUID[];
  v_new_id UUID;
BEGIN
  SELECT * INTO v_source
  FROM public.workflow_templates
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.services
  WHERE id = v_source.service_id
  FOR UPDATE;

  SELECT * INTO v_source
  FROM public.workflow_templates
  WHERE id = p_template_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Child DML does not lock the parent template row. These short SHARE locks
  -- give the clone one consistent graph and wait for in-flight Draft edits.
  LOCK TABLE public.workflow_template_stages IN SHARE MODE;
  LOCK TABLE public.workflow_template_stage_items IN SHARE MODE;
  LOCK TABLE public.workflow_template_stage_dependencies IN SHARE MODE;
  LOCK TABLE public.workflow_template_item_dependencies IN SHARE MODE;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.workflow_templates
  WHERE service_id = v_source.service_id;

  INSERT INTO public.workflow_templates (
    service_id, service_code, name, description, version, status,
    is_default, created_by, updated_by, published_at, published_by
  ) VALUES (
    v_source.service_id, v_source.service_code, v_source.name,
    v_source.description, v_next_version, 'draft', false,
    p_actor_id, p_actor_id, NULL, NULL
  ) RETURNING id INTO v_new_template_id;

  FOR v_stage IN
    SELECT * FROM public.workflow_template_stages
    WHERE workflow_template_id = p_template_id
    ORDER BY sort_order, id
  LOOP
    INSERT INTO public.workflow_template_stages (
      workflow_template_id, name, description, sort_order, is_required, sla_hours
    ) VALUES (
      v_new_template_id, v_stage.name, v_stage.description,
      v_stage.sort_order, v_stage.is_required, v_stage.sla_hours
    ) RETURNING id INTO v_new_id;
    v_old_stage_ids := array_append(v_old_stage_ids, v_stage.id);
    v_new_stage_ids := array_append(v_new_stage_ids, v_new_id);
  END LOOP;

  FOR v_item IN
    SELECT * FROM public.workflow_template_stage_items
    WHERE workflow_template_id = p_template_id
    ORDER BY sort_order, id
  LOOP
    INSERT INTO public.workflow_template_stage_items (
      workflow_template_stage_id, workflow_template_id,
      service_delivery_item_id, service_delivery_item_code, sort_order,
      approval_required, approval_scope, sla_hours, auto_create_task,
      completion_mode
    ) VALUES (
      v_new_stage_ids[array_position(v_old_stage_ids, v_item.workflow_template_stage_id)],
      v_new_template_id, v_item.service_delivery_item_id,
      v_item.service_delivery_item_code, v_item.sort_order,
      v_item.approval_required, v_item.approval_scope, v_item.sla_hours,
      v_item.auto_create_task, v_item.completion_mode
    ) RETURNING id INTO v_new_id;
    v_old_item_ids := array_append(v_old_item_ids, v_item.id);
    v_new_item_ids := array_append(v_new_item_ids, v_new_id);
  END LOOP;

  FOR v_dependency IN
    SELECT * FROM public.workflow_template_stage_dependencies
    WHERE workflow_template_id = p_template_id
    ORDER BY id
  LOOP
    INSERT INTO public.workflow_template_stage_dependencies (
      workflow_template_id, predecessor_stage_id, successor_stage_id,
      dependency_type, lag_hours
    ) VALUES (
      v_new_template_id,
      v_new_stage_ids[array_position(v_old_stage_ids, v_dependency.predecessor_stage_id)],
      v_new_stage_ids[array_position(v_old_stage_ids, v_dependency.successor_stage_id)],
      v_dependency.dependency_type, v_dependency.lag_hours
    );
  END LOOP;

  FOR v_dependency IN
    SELECT * FROM public.workflow_template_item_dependencies
    WHERE workflow_template_id = p_template_id
    ORDER BY id
  LOOP
    INSERT INTO public.workflow_template_item_dependencies (
      workflow_template_id, predecessor_stage_item_id,
      successor_stage_item_id, dependency_type, lag_hours
    ) VALUES (
      v_new_template_id,
      v_new_item_ids[array_position(v_old_item_ids, v_dependency.predecessor_stage_item_id)],
      v_new_item_ids[array_position(v_old_item_ids, v_dependency.successor_stage_item_id)],
      v_dependency.dependency_type, v_dependency.lag_hours
    );
  END LOOP;

  RETURN v_new_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_clone_template(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_clone_template(UUID, UUID) TO service_role;

-- Atomic default switch. At most one row can satisfy the partial unique index.
CREATE OR REPLACE FUNCTION public.workflow_set_default_template(
  p_template_id UUID,
  p_actor_id UUID
)
RETURNS public.workflow_templates
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_id UUID;
  v_status TEXT;
  v_result public.workflow_templates;
BEGIN
  SELECT service_id, status INTO v_service_id, v_status
  FROM public.workflow_templates
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.services WHERE id = v_service_id FOR UPDATE;

  SELECT status INTO v_status
  FROM public.workflow_templates
  WHERE id = p_template_id
  FOR UPDATE;

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'WORKFLOW_DEFAULT_REQUIRES_PUBLISHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workflow_templates
  SET is_default = false, updated_by = p_actor_id
  WHERE service_id = v_service_id AND is_default = true;

  UPDATE public.workflow_templates
  SET is_default = true, updated_by = p_actor_id
  WHERE id = p_template_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_set_default_template(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_set_default_template(UUID, UUID) TO service_role;

-- Atomic runtime snapshot, including both DAGs and every mapped delivery item.
CREATE OR REPLACE FUNCTION public.workflow_instantiate_project_service(
  p_project_id UUID,
  p_project_service_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_service RECORD;
  v_template public.workflow_templates;
  v_existing_id UUID;
  v_workflow_id UUID;
  v_stage RECORD;
  v_item RECORD;
  v_dependency RECORD;
  v_project_item RECORD;
  v_old_stage_ids UUID[] := ARRAY[]::UUID[];
  v_new_stage_ids UUID[] := ARRAY[]::UUID[];
  v_old_item_ids UUID[] := ARRAY[]::UUID[];
  v_new_item_ids UUID[] := ARRAY[]::UUID[];
  v_new_id UUID;
  v_stage_ready BOOLEAN;
  v_item_status TEXT;
BEGIN
  SELECT
    ps.id, ps.project_id, ps.service_id, ps.project_service_code,
    COALESCE(ps.project_code, p.project_code) AS project_code
  INTO v_project_service
  FROM public.project_services ps
  JOIN public.projects p ON p.id = ps.project_id
  WHERE ps.id = p_project_service_id
    AND ps.project_id = p_project_id
  FOR UPDATE OF ps;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_PROJECT_SERVICE_MISMATCH' USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.project_workflows
  WHERE project_service_id = p_project_service_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'instantiated', true,
      'workflowId', v_existing_id,
      'isExisting', true
    );
  END IF;

  -- Serialize default-template selection with workflow_set_default_template().
  PERFORM 1 FROM public.services
  WHERE id = v_project_service.service_id
  FOR SHARE;

  SELECT * INTO v_template
  FROM public.workflow_templates
  WHERE service_id = v_project_service.service_id
    AND status = 'published'
    AND is_default = true
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'instantiated', false,
      'reason', 'no_default_workflow'
    );
  END IF;

  INSERT INTO public.project_workflows (
    project_id, project_code, project_service_id, project_service_code,
    source_workflow_template_id, source_workflow_code,
    source_workflow_version, name_snapshot, status
  ) VALUES (
    p_project_id, v_project_service.project_code, p_project_service_id,
    v_project_service.project_service_code, v_template.id,
    v_template.workflow_code, v_template.version, v_template.name,
    'not_started'
  ) RETURNING id INTO v_workflow_id;

  FOR v_stage IN
    SELECT * FROM public.workflow_template_stages
    WHERE workflow_template_id = v_template.id
    ORDER BY sort_order, id
  LOOP
    v_stage_ready := NOT EXISTS (
      SELECT 1 FROM public.workflow_template_stage_dependencies d
      WHERE d.workflow_template_id = v_template.id
        AND d.successor_stage_id = v_stage.id
    );

    INSERT INTO public.project_workflow_stages (
      project_workflow_id, source_template_stage_id, name_snapshot,
      description_snapshot, sort_order, is_required, sla_hours_snapshot, status
    ) VALUES (
      v_workflow_id, v_stage.id, v_stage.name, v_stage.description,
      v_stage.sort_order, v_stage.is_required, v_stage.sla_hours,
      CASE WHEN v_stage_ready THEN 'ready' ELSE 'locked' END
    ) RETURNING id INTO v_new_id;
    v_old_stage_ids := array_append(v_old_stage_ids, v_stage.id);
    v_new_stage_ids := array_append(v_new_stage_ids, v_new_id);
  END LOOP;

  FOR v_item IN
    SELECT i.*
    FROM public.workflow_template_stage_items i
    JOIN public.workflow_template_stages s
      ON s.id = i.workflow_template_stage_id
    WHERE i.workflow_template_id = v_template.id
    ORDER BY s.sort_order, i.sort_order, i.id
  LOOP
    SELECT psi.id, psi.project_service_item_code
    INTO v_project_item
    FROM public.project_service_items psi
    WHERE psi.project_service_id = p_project_service_id
      AND psi.source_delivery_item_id = v_item.service_delivery_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORKFLOW_SNAPSHOT_INCONSISTENT' USING ERRCODE = 'P0001';
    END IF;

    v_stage_ready := NOT EXISTS (
      SELECT 1 FROM public.workflow_template_stage_dependencies d
      WHERE d.workflow_template_id = v_template.id
        AND d.successor_stage_id = v_item.workflow_template_stage_id
    );
    v_item_status := CASE
      WHEN NOT v_stage_ready THEN 'locked'
      WHEN EXISTS (
        SELECT 1 FROM public.workflow_template_item_dependencies d
        WHERE d.workflow_template_id = v_template.id
          AND d.successor_stage_item_id = v_item.id
      ) THEN 'blocked'
      ELSE 'ready'
    END;

    INSERT INTO public.project_workflow_stage_items (
      project_workflow_stage_id, project_workflow_id,
      project_service_item_id, project_service_item_code,
      source_template_stage_item_id, approval_required, approval_scope,
      sla_hours_snapshot, completion_mode, auto_create_task, status
    ) VALUES (
      v_new_stage_ids[array_position(v_old_stage_ids, v_item.workflow_template_stage_id)],
      v_workflow_id, v_project_item.id,
      v_project_item.project_service_item_code, v_item.id,
      v_item.approval_required, v_item.approval_scope, v_item.sla_hours,
      v_item.completion_mode, v_item.auto_create_task, v_item_status
    ) RETURNING id INTO v_new_id;
    v_old_item_ids := array_append(v_old_item_ids, v_item.id);
    v_new_item_ids := array_append(v_new_item_ids, v_new_id);
  END LOOP;

  FOR v_dependency IN
    SELECT * FROM public.workflow_template_stage_dependencies
    WHERE workflow_template_id = v_template.id
    ORDER BY id
  LOOP
    INSERT INTO public.project_workflow_stage_dependencies (
      project_workflow_id, predecessor_stage_id, successor_stage_id,
      dependency_type, lag_hours
    ) VALUES (
      v_workflow_id,
      v_new_stage_ids[array_position(v_old_stage_ids, v_dependency.predecessor_stage_id)],
      v_new_stage_ids[array_position(v_old_stage_ids, v_dependency.successor_stage_id)],
      v_dependency.dependency_type, v_dependency.lag_hours
    );
  END LOOP;

  FOR v_dependency IN
    SELECT * FROM public.workflow_template_item_dependencies
    WHERE workflow_template_id = v_template.id
    ORDER BY id
  LOOP
    INSERT INTO public.project_workflow_item_dependencies (
      project_workflow_id, predecessor_stage_item_id,
      successor_stage_item_id, dependency_type, lag_hours
    ) VALUES (
      v_workflow_id,
      v_new_item_ids[array_position(v_old_item_ids, v_dependency.predecessor_stage_item_id)],
      v_new_item_ids[array_position(v_old_item_ids, v_dependency.successor_stage_item_id)],
      v_dependency.dependency_type, v_dependency.lag_hours
    );
  END LOOP;

  INSERT INTO public.workflow_audit_events (
    project_id, project_workflow_id, entity_type, entity_id,
    action, actor_user_id, metadata
  ) VALUES (
    p_project_id, v_workflow_id, 'workflow', v_workflow_id,
    'workflow.instantiate', p_actor_id,
    jsonb_build_object('projectServiceId', p_project_service_id,
                       'templateId', v_template.id,
                       'templateVersion', v_template.version)
  );

  RETURN jsonb_build_object(
    'instantiated', true,
    'workflowId', v_workflow_id,
    'isExisting', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_instantiate_project_service(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_instantiate_project_service(UUID, UUID, UUID)
  TO service_role;

-- Atomic Task + primary Workflow link creation. Locking the runtime Item before
-- checking the partial unique index prevents concurrent retries from creating
-- an orphan Task while still using public.tasks as the single Task entity.
CREATE OR REPLACE FUNCTION public.workflow_create_primary_task(
  p_project_id UUID,
  p_workflow_stage_item_id UUID,
  p_project_service_item_id UUID,
  p_title TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item_id UUID;
  v_task public.tasks;
BEGIN
  SELECT i.id INTO v_item_id
  FROM public.project_workflow_stage_items i
  JOIN public.project_workflows w ON w.id = i.project_workflow_id
  WHERE i.id = p_workflow_stage_item_id
    AND w.project_id = p_project_id
    AND i.project_service_item_id = p_project_service_item_id
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TASK_ITEM_MISMATCH' USING ERRCODE = 'P0002';
  END IF;

  SELECT t.* INTO v_task
  FROM public.project_workflow_task_links l
  JOIN public.tasks t ON t.id = l.task_id
  WHERE l.project_workflow_stage_item_id = p_workflow_stage_item_id
    AND l.link_type = 'primary';

  IF FOUND THEN
    RETURN to_jsonb(v_task) || jsonb_build_object('workflowLinkExisting', true);
  END IF;

  INSERT INTO public.tasks (
    project_id,
    project_service_item_id,
    title,
    description,
    status,
    priority,
    assignee_user_id,
    reporter_user_id,
    start_date,
    due_date,
    sort_order,
    created_by,
    updated_by
  ) VALUES (
    p_project_id,
    p_project_service_item_id,
    p_title,
    NULL,
    'todo',
    'medium',
    NULL,
    p_actor_id,
    NULL,
    NULL,
    0,
    p_actor_id,
    p_actor_id
  )
  RETURNING * INTO v_task;

  INSERT INTO public.project_workflow_task_links (
    project_workflow_stage_item_id,
    task_id,
    link_type,
    created_by_workflow
  ) VALUES (
    p_workflow_stage_item_id,
    v_task.id,
    'primary',
    true
  );

  RETURN to_jsonb(v_task) || jsonb_build_object('workflowLinkExisting', false);
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_create_primary_task(UUID, UUID, UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_create_primary_task(UUID, UUID, UUID, TEXT, UUID)
  TO service_role;

-- Approval creation and the Item -> pending_approval transition are atomic.
-- Rejection and its Item-state reset are atomic as well. Approved Item
-- completion intentionally remains in the runtime reconciliation path because
-- it also checks Tasks, latest approvals for every required scope, dependency
-- snapshots, and Stage state before emitting audit/automation/unlock effects.
CREATE OR REPLACE FUNCTION public.workflow_request_approval(
  p_project_id UUID,
  p_workflow_id UUID,
  p_stage_item_id UUID,
  p_stage_id UUID,
  p_approval_type TEXT,
  p_request_note TEXT,
  p_actor_id UUID
)
RETURNS public.workflow_approval_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item RECORD;
  v_stage RECORD;
  v_workflow_status TEXT;
  v_result public.workflow_approval_requests;
BEGIN
  IF (p_stage_item_id IS NOT NULL)::integer
     + (p_stage_id IS NOT NULL)::integer <> 1 THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_approval_type IS NULL
     OR p_approval_type NOT IN ('internal', 'client') THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_TYPE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Every approval mutation locks in the same order:
  -- Workflow -> target Stage/Item -> Approval row (or insert).
  SELECT w.status INTO v_workflow_status
  FROM public.project_workflows w
  WHERE w.id = p_workflow_id
    AND w.project_id = p_project_id
  FOR UPDATE OF w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_workflow_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_STATE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF p_stage_item_id IS NOT NULL THEN
    SELECT i.*, s.status AS stage_status
    INTO v_item
    FROM public.project_workflow_stages s
    JOIN public.project_workflow_stage_items i
      ON i.project_workflow_stage_id = s.id
    WHERE i.id = p_stage_item_id
      AND i.project_workflow_id = p_workflow_id
      AND s.project_workflow_id = p_workflow_id
    FOR UPDATE OF s, i;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_item.stage_status NOT IN ('ready', 'in_progress')
       OR v_item.status NOT IN ('ready', 'in_progress', 'pending_approval') THEN
      RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_STATE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_item.approval_required
       OR (p_approval_type = 'internal' AND v_item.approval_scope NOT IN ('internal', 'both'))
       OR (p_approval_type = 'client' AND v_item.approval_scope NOT IN ('client', 'both')) THEN
      RAISE EXCEPTION 'WORKFLOW_APPROVAL_CONFIGURATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT s.*
    INTO v_stage
    FROM public.project_workflow_stages s
    WHERE s.id = p_stage_id
      AND s.project_workflow_id = p_workflow_id
    FOR UPDATE OF s;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_stage.status NOT IN ('ready', 'in_progress') THEN
      RAISE EXCEPTION 'WORKFLOW_APPROVAL_TARGET_STATE_INVALID' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.workflow_approval_requests (
    project_id,
    project_workflow_id,
    project_workflow_stage_id,
    project_workflow_stage_item_id,
    approval_type,
    status,
    requested_by_user_id,
    request_note
  ) VALUES (
    p_project_id,
    p_workflow_id,
    p_stage_id,
    p_stage_item_id,
    p_approval_type,
    'pending',
    p_actor_id,
    p_request_note
  )
  RETURNING * INTO v_result;

  IF p_stage_item_id IS NOT NULL THEN
    UPDATE public.project_workflow_stage_items
    SET status = 'pending_approval'
    WHERE id = p_stage_item_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_request_approval(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_request_approval(UUID, UUID, UUID, UUID, TEXT, TEXT, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.workflow_respond_approval(
  p_project_id UUID,
  p_workflow_id UUID,
  p_approval_id UUID,
  p_decision TEXT,
  p_decision_note TEXT,
  p_actor_id UUID
)
RETURNS public.workflow_approval_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_approval public.workflow_approval_requests;
  v_result public.workflow_approval_requests;
  v_workflow_status TEXT;
  v_target_stage_item_id UUID;
  v_target_stage_id UUID;
BEGIN
  IF p_decision IS NULL
     OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_DECISION_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Match workflow_request_approval(): Workflow -> target -> Approval.
  SELECT w.status INTO v_workflow_status
  FROM public.project_workflows w
  WHERE w.id = p_workflow_id
    AND w.project_id = p_project_id
  FOR UPDATE OF w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_workflow_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'WORKFLOW_INVALID_STATE' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.project_workflow_stage_item_id, a.project_workflow_stage_id
  INTO v_target_stage_item_id, v_target_stage_id
  FROM public.workflow_approval_requests a
  WHERE a.id = p_approval_id
    AND a.project_id = p_project_id
    AND a.project_workflow_id = p_workflow_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_target_stage_item_id IS NOT NULL THEN
    PERFORM 1
    FROM public.project_workflow_stages s
    JOIN public.project_workflow_stage_items i
      ON i.project_workflow_stage_id = s.id
    WHERE i.id = v_target_stage_item_id
      AND i.project_workflow_id = p_workflow_id
      AND s.project_workflow_id = p_workflow_id
    FOR UPDATE OF s, i;
  ELSIF v_target_stage_id IS NOT NULL THEN
    PERFORM 1
    FROM public.project_workflow_stages s
    WHERE s.id = v_target_stage_id
      AND s.project_workflow_id = p_workflow_id
    FOR UPDATE OF s;
  ELSE
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.* INTO v_approval
  FROM public.workflow_approval_requests a
  WHERE a.id = p_approval_id
    AND a.project_id = p_project_id
    AND a.project_workflow_id = p_workflow_id
    AND a.project_workflow_stage_item_id IS NOT DISTINCT FROM v_target_stage_item_id
    AND a.project_workflow_stage_id IS NOT DISTINCT FROM v_target_stage_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_approval.status <> 'pending' THEN
    RAISE EXCEPTION 'WORKFLOW_APPROVAL_ALREADY_RESPONDED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workflow_approval_requests
  SET status = p_decision,
      approver_user_id = p_actor_id,
      responded_at = now(),
      decision_note = p_decision_note
  WHERE id = p_approval_id
  RETURNING * INTO v_result;

  IF p_decision = 'rejected'
     AND v_approval.project_workflow_stage_item_id IS NOT NULL THEN
    UPDATE public.project_workflow_stage_items i
    SET status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.workflow_approval_requests pending
        WHERE pending.project_workflow_stage_item_id = i.id
          AND pending.status = 'pending'
      ) THEN 'pending_approval'
      WHEN i.started_at IS NOT NULL THEN 'in_progress'
      ELSE 'ready'
    END
    WHERE i.id = v_approval.project_workflow_stage_item_id
      AND i.status = 'pending_approval';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_respond_approval(UUID, UUID, UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_respond_approval(UUID, UUID, UUID, TEXT, TEXT, UUID)
  TO service_role;

-- All public Workflow tables remain backend-only. Explicit grants are needed
-- by current Supabase Data API defaults; browser roles get no business access.
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stage_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_stage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_stage_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workflow_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stage_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stage_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_item_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_stage_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_stage_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_item_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_task_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_approval_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_audit_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_stages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_stage_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_stage_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_item_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflow_stages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflow_stage_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflow_stage_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflow_item_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_workflow_task_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_approval_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_audit_events TO service_role;
