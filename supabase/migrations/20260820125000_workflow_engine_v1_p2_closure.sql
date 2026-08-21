-- ============================================================
-- Workflow Engine V1 - P2 database closure (SOURCE ONLY)
-- This migration must not be applied to Production by this task.
--
-- Locking contract:
--   * Template-writing RPCs lock the template row first.
--   * Publishing then takes template graph tables in the same SHARE order
--     used by the V1 clone RPC. Those short table locks are an accepted V1
--     limitation and close the publish-versus-direct-DML race.
--   * Direct graph guards intentionally do not lock the parent row: DML has
--     already acquired a table RowExclusiveLock before a row trigger runs,
--     so taking the parent lock there would invert the clone/publish order.
-- ============================================================

-- Runtime lag gates are computed once by the backend when a predecessor
-- completes/skips. NULL means that the dependency is not eligible yet;
-- overridden dependencies are resolved independently of this timestamp.
ALTER TABLE public.project_workflow_stage_dependencies
  ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ;

ALTER TABLE public.project_workflow_item_dependencies
  ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ;

COMMENT ON COLUMN public.project_workflow_stage_dependencies.eligible_at IS
  'Work-calendar-aware predecessor completion plus lag; NULL until computed.';
COMMENT ON COLUMN public.project_workflow_item_dependencies.eligible_at IS
  'Work-calendar-aware predecessor completion plus lag; NULL until computed.';

CREATE INDEX IF NOT EXISTS idx_project_workflow_stage_deps_pending_eligible
  ON public.project_workflow_stage_dependencies (
    project_workflow_id,
    successor_stage_id,
    eligible_at
  )
  WHERE overridden_at IS NULL AND eligible_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_workflow_item_deps_pending_eligible
  ON public.project_workflow_item_dependencies (
    project_workflow_id,
    successor_stage_item_id,
    eligible_at
  )
  WHERE overridden_at IS NULL AND eligible_at IS NOT NULL;

-- Business codes are generated and immutable already. These checks prevent a
-- privileged caller from inserting malformed non-generated values. NOT VALID
-- keeps the initial lock short; validation still makes the final contract
-- fully trusted and deliberately surfaces any legacy bad data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_templates_business_code_format'
      AND conrelid = 'public.workflow_templates'::regclass
  ) THEN
    ALTER TABLE public.workflow_templates
      ADD CONSTRAINT workflow_templates_business_code_format
      CHECK (workflow_code ~ '^QTDV_[0-9]{2,}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_template_stages_business_code_format'
      AND conrelid = 'public.workflow_template_stages'::regclass
  ) THEN
    ALTER TABLE public.workflow_template_stages
      ADD CONSTRAINT workflow_template_stages_business_code_format
      CHECK (stage_code ~ '^GDQT_[0-9]{2,}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_workflows_business_code_format'
      AND conrelid = 'public.project_workflows'::regclass
  ) THEN
    ALTER TABLE public.project_workflows
      ADD CONSTRAINT project_workflows_business_code_format
      CHECK (project_workflow_code ~ '^QTDA_[0-9]{2,}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_workflow_stages_business_code_format'
      AND conrelid = 'public.project_workflow_stages'::regclass
  ) THEN
    ALTER TABLE public.project_workflow_stages
      ADD CONSTRAINT project_workflow_stages_business_code_format
      CHECK (project_workflow_stage_code ~ '^GDDA_[0-9]{2,}$') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.workflow_templates
  VALIDATE CONSTRAINT workflow_templates_business_code_format;
ALTER TABLE public.workflow_template_stages
  VALIDATE CONSTRAINT workflow_template_stages_business_code_format;
ALTER TABLE public.project_workflows
  VALIDATE CONSTRAINT project_workflows_business_code_format;
ALTER TABLE public.project_workflow_stages
  VALIDATE CONSTRAINT project_workflow_stages_business_code_format;

-- Only forward lifecycle transitions are valid. A published template may only
-- change default-selection metadata or advance to archived. Publishing takes
-- SHARE locks so all earlier graph writes finish before status becomes visible,
-- and later graph writes see the immutable status after waiting.
CREATE OR REPLACE FUNCTION public.workflow_guard_template_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF (
      to_jsonb(NEW) - ARRAY[
        'status', 'published_by', 'published_at', 'updated_by', 'updated_at'
      ]::TEXT[]
    ) <> (
      to_jsonb(OLD) - ARRAY[
        'status', 'published_by', 'published_at', 'updated_by', 'updated_at'
      ]::TEXT[]
    ) THEN
      RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
        USING ERRCODE = 'P0001';
    END IF;

    LOCK TABLE public.workflow_template_stages IN SHARE MODE;
    LOCK TABLE public.workflow_template_stage_items IN SHARE MODE;
    LOCK TABLE public.workflow_template_stage_dependencies IN SHARE MODE;
    LOCK TABLE public.workflow_template_item_dependencies IN SHARE MODE;
    RETURN NEW;
  END IF;

  IF OLD.status = 'published' AND NEW.status = 'published' THEN
    IF (
      to_jsonb(NEW) - ARRAY['is_default', 'updated_by', 'updated_at']::TEXT[]
    ) = (
      to_jsonb(OLD) - ARRAY['is_default', 'updated_by', 'updated_at']::TEXT[]
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF OLD.status = 'published' AND NEW.status = 'archived' THEN
    IF (
      to_jsonb(NEW) - ARRAY[
        'status', 'is_default', 'updated_by', 'updated_at'
      ]::TEXT[]
    ) = (
      to_jsonb(OLD) - ARRAY[
        'status', 'is_default', 'updated_by', 'updated_at'
      ]::TEXT[]
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_guard_template_lifecycle()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_guard_template_lifecycle()
  TO service_role;

DROP TRIGGER IF EXISTS trg_workflow_template_lifecycle_guard
  ON public.workflow_templates;
CREATE TRIGGER trg_workflow_template_lifecycle_guard
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_guard_template_lifecycle();

CREATE OR REPLACE FUNCTION public.workflow_guard_draft_template_graph()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template_id UUID;
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_template_id := (to_jsonb(OLD) ->> 'workflow_template_id')::UUID;
  ELSE
    v_template_id := (to_jsonb(NEW) ->> 'workflow_template_id')::UUID;
  END IF;

  -- Do not take a parent-row lock here. The lifecycle trigger's ordered SHARE
  -- locks serialize publishing with graph DML without creating a lock inversion.
  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = v_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_guard_draft_template_graph()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_guard_draft_template_graph()
  TO service_role;

DROP TRIGGER IF EXISTS trg_workflow_template_stages_draft_guard
  ON public.workflow_template_stages;
CREATE TRIGGER trg_workflow_template_stages_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.workflow_template_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_guard_draft_template_graph();

DROP TRIGGER IF EXISTS trg_workflow_template_stage_items_draft_guard
  ON public.workflow_template_stage_items;
CREATE TRIGGER trg_workflow_template_stage_items_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.workflow_template_stage_items
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_guard_draft_template_graph();

DROP TRIGGER IF EXISTS trg_workflow_template_stage_deps_draft_guard
  ON public.workflow_template_stage_dependencies;
CREATE TRIGGER trg_workflow_template_stage_deps_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.workflow_template_stage_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_guard_draft_template_graph();

DROP TRIGGER IF EXISTS trg_workflow_template_item_deps_draft_guard
  ON public.workflow_template_item_dependencies;
CREATE TRIGGER trg_workflow_template_item_deps_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.workflow_template_item_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_guard_draft_template_graph();

-- Serialized template dependency writers. All calls lock Template -> graph
-- nodes/dependency rows. The template lock serializes cycle checks per graph.
CREATE OR REPLACE FUNCTION public.workflow_add_stage_dependency(
  p_template_id UUID,
  p_predecessor_stage_id UUID,
  p_successor_stage_id UUID,
  p_lag_hours INTEGER,
  p_actor_id UUID
)
RETURNS public.workflow_template_stage_dependencies
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_node_count INTEGER;
  v_result public.workflow_template_stage_dependencies;
BEGIN
  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = p_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_lag_hours IS NULL OR p_lag_hours < 0 THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_LAG_INVALID'
      USING ERRCODE = '22023';
  END IF;
  IF p_predecessor_stage_id IS NULL
     OR p_successor_stage_id IS NULL
     OR p_predecessor_stage_id = p_successor_stage_id THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_CROSS_TEMPLATE'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)
  INTO v_node_count
  FROM (
    SELECT s.id
    FROM public.workflow_template_stages AS s
    WHERE s.workflow_template_id = p_template_id
      AND s.id IN (p_predecessor_stage_id, p_successor_stage_id)
    ORDER BY s.id
    FOR SHARE
  ) AS locked_nodes;

  IF v_node_count <> 2 THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_CROSS_TEMPLATE'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workflow_template_stage_dependencies AS d
    WHERE d.workflow_template_id = p_template_id
      AND d.predecessor_stage_id = p_predecessor_stage_id
      AND d.successor_stage_id = p_successor_stage_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_EXISTS'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    WITH RECURSIVE reachable(node_id) AS (
      SELECT d.successor_stage_id
      FROM public.workflow_template_stage_dependencies AS d
      WHERE d.workflow_template_id = p_template_id
        AND d.predecessor_stage_id = p_successor_stage_id
      UNION
      SELECT d.successor_stage_id
      FROM public.workflow_template_stage_dependencies AS d
      INNER JOIN reachable AS r
        ON d.predecessor_stage_id = r.node_id
      WHERE d.workflow_template_id = p_template_id
    )
    SELECT 1
    FROM reachable
    WHERE node_id = p_predecessor_stage_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_STAGE_DEPENDENCY_CYCLE'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.workflow_template_stage_dependencies (
    workflow_template_id,
    predecessor_stage_id,
    successor_stage_id,
    dependency_type,
    lag_hours
  ) VALUES (
    p_template_id,
    p_predecessor_stage_id,
    p_successor_stage_id,
    'finish_to_start',
    p_lag_hours
  )
  RETURNING * INTO v_result;

  UPDATE public.workflow_templates
  SET updated_by = p_actor_id
  WHERE id = p_template_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_add_stage_dependency(
  UUID, UUID, UUID, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_add_stage_dependency(
  UUID, UUID, UUID, INTEGER, UUID
) TO service_role;

CREATE OR REPLACE FUNCTION public.workflow_delete_stage_dependency(
  p_dependency_id UUID,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template_id UUID;
  v_status TEXT;
  v_deleted_id UUID;
BEGIN
  -- Discover the parent without locking the child; the authoritative read is
  -- repeated after acquiring the template lock to preserve lock order.
  SELECT d.workflow_template_id
  INTO v_template_id
  FROM public.workflow_template_stage_dependencies AS d
  WHERE d.id = p_dependency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = v_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.workflow_template_stage_dependencies AS d
  WHERE d.id = p_dependency_id
    AND d.workflow_template_id = v_template_id
  RETURNING d.id INTO v_deleted_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workflow_templates
  SET updated_by = p_actor_id
  WHERE id = v_template_id;

  RETURN v_deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_delete_stage_dependency(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_delete_stage_dependency(UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.workflow_add_item_dependency(
  p_template_id UUID,
  p_predecessor_stage_item_id UUID,
  p_successor_stage_item_id UUID,
  p_lag_hours INTEGER,
  p_actor_id UUID
)
RETURNS public.workflow_template_item_dependencies
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_node_count INTEGER;
  v_result public.workflow_template_item_dependencies;
BEGIN
  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = p_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_lag_hours IS NULL OR p_lag_hours < 0 THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_LAG_INVALID'
      USING ERRCODE = '22023';
  END IF;
  IF p_predecessor_stage_item_id IS NULL
     OR p_successor_stage_item_id IS NULL
     OR p_predecessor_stage_item_id = p_successor_stage_item_id THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_CROSS_TEMPLATE'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)
  INTO v_node_count
  FROM (
    SELECT i.id
    FROM public.workflow_template_stage_items AS i
    WHERE i.workflow_template_id = p_template_id
      AND i.id IN (
        p_predecessor_stage_item_id,
        p_successor_stage_item_id
      )
    ORDER BY i.id
    FOR SHARE
  ) AS locked_nodes;

  IF v_node_count <> 2 THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_CROSS_TEMPLATE'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workflow_template_item_dependencies AS d
    WHERE d.workflow_template_id = p_template_id
      AND d.predecessor_stage_item_id = p_predecessor_stage_item_id
      AND d.successor_stage_item_id = p_successor_stage_item_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_EXISTS'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    WITH RECURSIVE reachable(node_id) AS (
      SELECT d.successor_stage_item_id
      FROM public.workflow_template_item_dependencies AS d
      WHERE d.workflow_template_id = p_template_id
        AND d.predecessor_stage_item_id = p_successor_stage_item_id
      UNION
      SELECT d.successor_stage_item_id
      FROM public.workflow_template_item_dependencies AS d
      INNER JOIN reachable AS r
        ON d.predecessor_stage_item_id = r.node_id
      WHERE d.workflow_template_id = p_template_id
    )
    SELECT 1
    FROM reachable
    WHERE node_id = p_predecessor_stage_item_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_ITEM_DEPENDENCY_CYCLE'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.workflow_template_item_dependencies (
    workflow_template_id,
    predecessor_stage_item_id,
    successor_stage_item_id,
    dependency_type,
    lag_hours
  ) VALUES (
    p_template_id,
    p_predecessor_stage_item_id,
    p_successor_stage_item_id,
    'finish_to_start',
    p_lag_hours
  )
  RETURNING * INTO v_result;

  UPDATE public.workflow_templates
  SET updated_by = p_actor_id
  WHERE id = p_template_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_add_item_dependency(
  UUID, UUID, UUID, INTEGER, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_add_item_dependency(
  UUID, UUID, UUID, INTEGER, UUID
) TO service_role;

CREATE OR REPLACE FUNCTION public.workflow_delete_item_dependency(
  p_dependency_id UUID,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_template_id UUID;
  v_status TEXT;
  v_deleted_id UUID;
BEGIN
  SELECT d.workflow_template_id
  INTO v_template_id
  FROM public.workflow_template_item_dependencies AS d
  WHERE d.id = p_dependency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = v_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.workflow_template_item_dependencies AS d
  WHERE d.id = p_dependency_id
    AND d.workflow_template_id = v_template_id
  RETURNING d.id INTO v_deleted_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_DEPENDENCY_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workflow_templates
  SET updated_by = p_actor_id
  WHERE id = v_template_id;

  RETURN v_deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_delete_item_dependency(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_delete_item_dependency(UUID, UUID)
  TO service_role;

-- Reorder every stage in one draft template. Temporary values are chosen
-- strictly outside the current range so the immediate unique constraint never
-- sees a transient collision, then the requested 1..N order is assigned.
CREATE OR REPLACE FUNCTION public.workflow_reorder_template_stages(
  p_template_id UUID,
  p_stage_ids UUID[],
  p_actor_id UUID
)
RETURNS SETOF public.workflow_template_stages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_stage_count BIGINT;
  v_input_count BIGINT;
  v_distinct_count BIGINT;
  v_null_count BIGINT;
  v_matched_count BIGINT;
  v_min_sort INTEGER;
  v_max_sort INTEGER;
  v_offset BIGINT;
  v_use_high BOOLEAN;
BEGIN
  SELECT t.status
  INTO v_status
  FROM public.workflow_templates AS t
  WHERE t.id = p_template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'WORKFLOW_TEMPLATE_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_stage_ids IS NULL THEN
    RAISE EXCEPTION 'WORKFLOW_STAGE_ORDER_INVALID'
      USING ERRCODE = '22023';
  END IF;

  LOCK TABLE public.workflow_template_stages IN SHARE MODE;

  SELECT COUNT(*), MIN(s.sort_order), MAX(s.sort_order)
  INTO v_stage_count, v_min_sort, v_max_sort
  FROM public.workflow_template_stages AS s
  WHERE s.workflow_template_id = p_template_id;

  SELECT
    COUNT(*),
    COUNT(DISTINCT input.stage_id),
    COUNT(*) FILTER (WHERE input.stage_id IS NULL)
  INTO v_input_count, v_distinct_count, v_null_count
  FROM unnest(p_stage_ids) AS input(stage_id);

  SELECT COUNT(*)
  INTO v_matched_count
  FROM public.workflow_template_stages AS s
  WHERE s.workflow_template_id = p_template_id
    AND s.id = ANY (p_stage_ids);

  IF v_input_count <> v_stage_count
     OR v_distinct_count <> v_input_count
     OR v_null_count <> 0
     OR v_matched_count <> v_stage_count THEN
    RAISE EXCEPTION 'WORKFLOW_STAGE_ORDER_INVALID'
      USING ERRCODE = '22023';
  END IF;

  IF v_stage_count > 0 THEN
    IF v_max_sort::BIGINT + v_stage_count <= 2147483647 THEN
      v_use_high := true;
      v_offset := v_max_sort::BIGINT;
    ELSIF v_min_sort::BIGINT - v_stage_count >= -2147483648 THEN
      v_use_high := false;
      v_offset := v_min_sort::BIGINT;
    ELSE
      RAISE EXCEPTION 'WORKFLOW_STAGE_ORDER_RANGE_EXHAUSTED'
        USING ERRCODE = '22003';
    END IF;

    UPDATE public.workflow_template_stages AS s
    SET sort_order = (
      CASE
        WHEN v_use_high THEN
          v_offset + array_position(p_stage_ids, s.id)
        ELSE
          v_offset - array_position(p_stage_ids, s.id)
      END
    )::INTEGER
    WHERE s.workflow_template_id = p_template_id;

    UPDATE public.workflow_template_stages AS s
    SET sort_order = array_position(p_stage_ids, s.id)
    WHERE s.workflow_template_id = p_template_id;
  END IF;

  UPDATE public.workflow_templates
  SET updated_by = p_actor_id
  WHERE id = p_template_id;

  RETURN QUERY
  SELECT s.*
  FROM public.workflow_template_stages AS s
  WHERE s.workflow_template_id = p_template_id
  ORDER BY s.sort_order, s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_reorder_template_stages(
  UUID, UUID[], UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_reorder_template_stages(
  UUID, UUID[], UUID
) TO service_role;

-- Runtime ownership guards reject redundant foreign-key combinations that are
-- individually valid but point into different projects/workflows.
CREATE OR REPLACE FUNCTION public.workflow_validate_runtime_stage_item_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_workflow_stages AS s
    INNER JOIN public.project_workflows AS w
      ON w.id = NEW.project_workflow_id
     AND s.project_workflow_id = w.id
    INNER JOIN public.project_service_items AS psi
      ON psi.id = NEW.project_service_item_id
     AND psi.project_service_id = w.project_service_id
     AND psi.project_id = w.project_id
    WHERE s.id = NEW.project_workflow_stage_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_validate_runtime_stage_item_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_validate_runtime_stage_item_ownership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_project_workflow_stage_items_ownership
  ON public.project_workflow_stage_items;
CREATE TRIGGER trg_project_workflow_stage_items_ownership
  BEFORE INSERT OR UPDATE OF
    project_workflow_stage_id,
    project_workflow_id,
    project_service_item_id
  ON public.project_workflow_stage_items
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_validate_runtime_stage_item_ownership();

CREATE OR REPLACE FUNCTION public.workflow_validate_task_link_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_workflow_stage_items AS i
    INNER JOIN public.project_workflows AS w
      ON w.id = i.project_workflow_id
    INNER JOIN public.tasks AS t
      ON t.id = NEW.task_id
     AND t.project_id = w.project_id
    WHERE i.id = NEW.project_workflow_stage_item_id
      AND (
        NEW.link_type <> 'primary'
        OR t.project_service_item_id = i.project_service_item_id
      )
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_validate_task_link_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_validate_task_link_ownership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_project_workflow_task_links_ownership
  ON public.project_workflow_task_links;
CREATE TRIGGER trg_project_workflow_task_links_ownership
  BEFORE INSERT OR UPDATE OF project_workflow_stage_item_id, task_id, link_type
  ON public.project_workflow_task_links
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_validate_task_link_ownership();

CREATE OR REPLACE FUNCTION public.workflow_validate_approval_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.project_workflow_stage_id IS NOT NULL)::INTEGER
     + (NEW.project_workflow_stage_item_id IS NOT NULL)::INTEGER <> 1 THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_workflows AS w
    WHERE w.id = NEW.project_workflow_id
      AND w.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.project_workflow_stage_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.project_workflow_stages AS s
       WHERE s.id = NEW.project_workflow_stage_id
         AND s.project_workflow_id = NEW.project_workflow_id
     ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.project_workflow_stage_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.project_workflow_stage_items AS i
       WHERE i.id = NEW.project_workflow_stage_item_id
         AND i.project_workflow_id = NEW.project_workflow_id
     ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_validate_approval_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_validate_approval_ownership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_workflow_approval_requests_ownership
  ON public.workflow_approval_requests;
CREATE TRIGGER trg_workflow_approval_requests_ownership
  BEFORE INSERT OR UPDATE OF
    project_id,
    project_workflow_id,
    project_workflow_stage_id,
    project_workflow_stage_item_id
  ON public.workflow_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_validate_approval_ownership();

CREATE OR REPLACE FUNCTION public.workflow_validate_runtime_stage_dependency_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_workflow_stages AS predecessor
    INNER JOIN public.project_workflow_stages AS successor
      ON successor.id = NEW.successor_stage_id
     AND successor.project_workflow_id = NEW.project_workflow_id
    WHERE predecessor.id = NEW.predecessor_stage_id
      AND predecessor.project_workflow_id = NEW.project_workflow_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_validate_runtime_stage_dependency_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_validate_runtime_stage_dependency_ownership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_project_workflow_stage_deps_ownership
  ON public.project_workflow_stage_dependencies;
CREATE TRIGGER trg_project_workflow_stage_deps_ownership
  BEFORE INSERT OR UPDATE OF
    project_workflow_id,
    predecessor_stage_id,
    successor_stage_id
  ON public.project_workflow_stage_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_validate_runtime_stage_dependency_ownership();

CREATE OR REPLACE FUNCTION public.workflow_validate_runtime_item_dependency_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_workflow_stage_items AS predecessor
    INNER JOIN public.project_workflow_stage_items AS successor
      ON successor.id = NEW.successor_stage_item_id
     AND successor.project_workflow_id = NEW.project_workflow_id
    WHERE predecessor.id = NEW.predecessor_stage_item_id
      AND predecessor.project_workflow_id = NEW.project_workflow_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_RUNTIME_OWNERSHIP_INVALID'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_validate_runtime_item_dependency_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_validate_runtime_item_dependency_ownership()
  TO service_role;

DROP TRIGGER IF EXISTS trg_project_workflow_item_deps_ownership
  ON public.project_workflow_item_dependencies;
CREATE TRIGGER trg_project_workflow_item_deps_ownership
  BEFORE INSERT OR UPDATE OF
    project_workflow_id,
    predecessor_stage_item_id,
    successor_stage_item_id
  ON public.project_workflow_item_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.workflow_validate_runtime_item_dependency_ownership();
