-- ============================================================
-- Phase 4 Fix Round 1
-- Git-only migration. External review applies it to Supabase DEV.
-- Hardens project viewer permissions, board lock ordering and the
-- recoverable file deletion lifecycle.
-- ============================================================

ALTER TABLE public.project_files
  ADD COLUMN delete_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN delete_requested_at TIMESTAMPTZ;

ALTER TABLE public.project_files
  ADD CONSTRAINT project_files_delete_state_valid CHECK (
    (delete_status = 'active' AND delete_requested_at IS NULL)
    OR
    (delete_status = 'deleting' AND delete_requested_at IS NOT NULL)
  );

CREATE INDEX project_files_project_active_created_idx
  ON public.project_files (project_id, created_at DESC, id DESC)
  WHERE delete_status = 'active';

CREATE INDEX project_files_deleting_requested_idx
  ON public.project_files (delete_requested_at, id)
  WHERE delete_status = 'deleting';

-- New tasks participate in the same project-level serialization as board
-- moves. Status changes no longer use this row trigger because PostgreSQL
-- acquires the task row lock before a BEFORE UPDATE trigger runs.
DROP TRIGGER trigger_phase4_assign_task_sort_order ON public.tasks;

CREATE OR REPLACE FUNCTION public.phase4_assign_task_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'TASK_ORDERING_WRITE_INVALID' USING ERRCODE = 'P4032';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::TEXT, 0));

  SELECT COALESCE(MAX(t.sort_order), 0) + 1000
  INTO NEW.sort_order
  FROM public.tasks t
  WHERE t.project_id = NEW.project_id
    AND t.status = NEW.status;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase4_assign_task_sort_order
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.phase4_assign_task_sort_order();

-- Reject any future generic status/sort/project write that would bypass the
-- project-first ordering protocol. The transaction-local flag is set only by
-- the serialized RPCs below.
CREATE OR REPLACE FUNCTION public.phase4_guard_task_ordering_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('app.phase4_ordering_write', TRUE) IS DISTINCT FROM 'allowed'
     AND (
       NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
     ) THEN
    RAISE EXCEPTION 'TASK_ORDERING_RPC_REQUIRED' USING ERRCODE = 'P4033';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase4_guard_task_ordering_write
  BEFORE UPDATE OF project_id, status, sort_order ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.phase4_guard_task_ordering_write();

-- Ordinary status changes append the task to its target column. Reading the
-- project id is deliberately lock-free; the project advisory lock is always
-- acquired before the task row or any board rows are locked.
CREATE OR REPLACE FUNCTION public.phase4_change_task_status(
  p_task_id UUID,
  p_project_id UUID,
  p_target_status public.task_status,
  p_actor_user_id UUID
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_task public.tasks%ROWTYPE;
  v_next_sort_order INTEGER;
BEGIN
  SELECT t.project_id
  INTO v_project_id
  FROM public.tasks t
  WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P4030';
  END IF;
  IF v_project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'TASK_PROJECT_CHANGED' USING ERRCODE = 'P4031';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_project_id::TEXT, 0));

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P4030';
  END IF;
  IF v_task.project_id IS DISTINCT FROM v_project_id THEN
    RAISE EXCEPTION 'TASK_PROJECT_CHANGED' USING ERRCODE = 'P4031';
  END IF;

  -- Lock active board rows in one deterministic order after the moved task.
  PERFORM t.id
  FROM public.tasks t
  WHERE t.project_id = v_project_id
    AND t.status IN ('todo', 'in_progress', 'review', 'done')
  ORDER BY t.status, t.sort_order, t.id
  FOR UPDATE;

  IF v_task.status IS NOT DISTINCT FROM p_target_status THEN
    UPDATE public.tasks
    SET updated_by = p_actor_user_id
    WHERE id = p_task_id
    RETURNING * INTO v_task;
    RETURN v_task;
  END IF;

  SELECT COALESCE(MAX(t.sort_order), 0) + 1000
  INTO v_next_sort_order
  FROM public.tasks t
  WHERE t.project_id = v_project_id
    AND t.status = p_target_status
    AND t.id <> p_task_id;

  PERFORM set_config('app.phase4_ordering_write', 'allowed', TRUE);

  UPDATE public.tasks
  SET status = p_target_status,
      sort_order = v_next_sort_order,
      updated_by = p_actor_user_id
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

-- Board reordering follows the same lock order as ordinary status changes:
-- lock-free project lookup, project advisory lock, moved row, then all active
-- board rows in deterministic order.
CREATE OR REPLACE FUNCTION public.move_task_on_board(
  p_task_id UUID,
  p_target_status public.task_status,
  p_actor_user_id UUID,
  p_before_task_id UUID DEFAULT NULL,
  p_after_task_id UUID DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_task public.tasks%ROWTYPE;
  v_neighbor public.tasks%ROWTYPE;
  v_ordered_ids UUID[] := ARRAY[]::UUID[];
  v_new_ids UUID[] := ARRAY[]::UUID[];
  v_count INTEGER := 0;
  v_insert_position INTEGER := 1;
  v_before_position INTEGER;
  v_after_position INTEGER;
  v_index INTEGER;
BEGIN
  IF p_target_status NOT IN ('todo', 'in_progress', 'review', 'done') THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;
  IF p_before_task_id = p_task_id OR p_after_task_id = p_task_id THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;

  SELECT t.project_id
  INTO v_project_id
  FROM public.tasks t
  WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_project_id::TEXT, 0));

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_task.project_id IS DISTINCT FROM v_project_id
     OR v_task.status = 'cancelled' THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;

  PERFORM t.id
  FROM public.tasks t
  WHERE t.project_id = v_project_id
    AND t.status IN ('todo', 'in_progress', 'review', 'done')
  ORDER BY t.status, t.sort_order, t.id
  FOR UPDATE;

  IF p_before_task_id IS NOT NULL THEN
    SELECT * INTO v_neighbor
    FROM public.tasks
    WHERE id = p_before_task_id
      AND project_id = v_project_id
      AND status = p_target_status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
    END IF;
  END IF;

  IF p_after_task_id IS NOT NULL THEN
    SELECT * INTO v_neighbor
    FROM public.tasks
    WHERE id = p_after_task_id
      AND project_id = v_project_id
      AND status = p_target_status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
    END IF;
  END IF;

  SELECT COALESCE(
    array_agg(t.id ORDER BY t.sort_order ASC, t.id ASC),
    ARRAY[]::UUID[]
  )
  INTO v_ordered_ids
  FROM public.tasks t
  WHERE t.project_id = v_project_id
    AND t.status = p_target_status
    AND t.id <> p_task_id;

  v_count := cardinality(v_ordered_ids);
  v_before_position := array_position(v_ordered_ids, p_before_task_id);
  v_after_position := array_position(v_ordered_ids, p_after_task_id);

  IF p_before_task_id IS NOT NULL AND v_before_position IS NULL THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;
  IF p_after_task_id IS NOT NULL AND v_after_position IS NULL THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;
  IF p_before_task_id IS NOT NULL AND p_after_task_id IS NOT NULL
     AND v_before_position <> v_after_position + 1 THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;

  IF p_before_task_id IS NOT NULL THEN
    v_insert_position := v_before_position;
  ELSIF p_after_task_id IS NOT NULL THEN
    v_insert_position := v_after_position + 1;
  ELSE
    v_insert_position := v_count + 1;
  END IF;

  IF v_insert_position = 1 THEN
    v_new_ids := ARRAY[p_task_id] || v_ordered_ids;
  ELSIF v_insert_position > v_count THEN
    v_new_ids := v_ordered_ids || ARRAY[p_task_id];
  ELSE
    v_new_ids := v_ordered_ids[1:v_insert_position - 1]
      || ARRAY[p_task_id]
      || v_ordered_ids[v_insert_position:v_count];
  END IF;

  PERFORM set_config('app.phase4_ordering_write', 'allowed', TRUE);

  UPDATE public.tasks
  SET status = p_target_status,
      sort_order = -2147483648,
      updated_by = p_actor_user_id
  WHERE id = p_task_id;

  FOR v_index IN 1..cardinality(v_new_ids) LOOP
    UPDATE public.tasks
    SET sort_order = -v_index,
        updated_by = p_actor_user_id
    WHERE id = v_new_ids[v_index];
  END LOOP;

  FOR v_index IN 1..cardinality(v_new_ids) LOOP
    UPDATE public.tasks
    SET sort_order = v_index * 1000,
        updated_by = p_actor_user_id
    WHERE id = v_new_ids[v_index];
  END LOOP;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  RETURN v_task;
END;
$$;

-- File deletion is a recoverable state machine around the non-transactional
-- Storage API call. Request is idempotent, restore is safe after a Storage
-- failure, and finalize only removes rows already marked as deleting.
CREATE OR REPLACE FUNCTION public.phase4_request_project_file_delete(
  p_file_id UUID
)
RETURNS public.project_files
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_file public.project_files%ROWTYPE;
BEGIN
  SELECT * INTO v_file
  FROM public.project_files
  WHERE id = p_file_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P4040';
  END IF;

  IF v_file.delete_status = 'active' THEN
    UPDATE public.project_files
    SET delete_status = 'deleting',
        delete_requested_at = NOW()
    WHERE id = p_file_id
    RETURNING * INTO v_file;
  END IF;

  RETURN v_file;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase4_restore_project_file_delete(
  p_file_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.project_files
  SET delete_status = 'active',
      delete_requested_at = NULL
  WHERE id = p_file_id
    AND delete_status = 'deleting';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase4_finalize_project_file_delete(
  p_file_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.project_files
  WHERE id = p_file_id
    AND delete_status = 'deleting';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.phase4_assign_task_sort_order()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_guard_task_ordering_write()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_change_task_status(
  UUID, UUID, public.task_status, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_task_on_board(
  UUID, public.task_status, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_request_project_file_delete(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_restore_project_file_delete(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_finalize_project_file_delete(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase4_assign_task_sort_order()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_guard_task_ordering_write()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_change_task_status(
  UUID, UUID, public.task_status, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_task_on_board(
  UUID, public.task_status, UUID, UUID, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_request_project_file_delete(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_restore_project_file_delete(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_finalize_project_file_delete(UUID)
  TO service_role;
