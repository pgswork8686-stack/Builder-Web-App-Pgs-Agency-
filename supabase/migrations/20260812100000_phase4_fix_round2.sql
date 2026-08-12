-- Migration: public.phase4_update_task_atomic
-- Timestamp: 20260812100000

-- A single database function to perform atomic task updates when the PATCH contains status
-- together with other task fields.

CREATE OR REPLACE FUNCTION public.phase4_update_task_atomic(
  p_project_id             UUID,
  p_task_id                UUID,
  p_actor_user_id          UUID,
  p_set_parent_task        BOOLEAN,
  p_parent_task_id         UUID,
  p_set_title              BOOLEAN,
  p_title                  TEXT,
  p_set_description        BOOLEAN,
  p_description            TEXT,
  p_set_status             BOOLEAN,
  p_status                 public.task_status,
  p_set_priority           BOOLEAN,
  p_priority               public.task_priority,
  p_set_assignee           BOOLEAN,
  p_assignee_user_id       UUID,
  p_set_start_date         BOOLEAN,
  p_start_date             DATE,
  p_set_due_date           BOOLEAN,
  p_due_date               DATE
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
  v_effective_start DATE;
  v_effective_due DATE;
  v_assignee_ok BOOLEAN;
  v_parent_task_project UUID;
BEGIN
  -- A. Read task project_id WITHOUT row lock
  SELECT t.project_id
  INTO v_project_id
  FROM public.tasks t
  WHERE t.id = p_task_id;

  -- B. Verify task exists and initial project matches requested project
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P4030';
  END IF;

  IF v_project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'TASK_PROJECT_CHANGED' USING ERRCODE = 'P4031';
  END IF;

  -- C. Acquire project advisory transaction lock
  PERFORM pg_advisory_xact_lock(hashtextextended(v_project_id::TEXT, 0));

  -- D. Only AFTER advisory lock: SELECT task FOR UPDATE
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P4030';
  END IF;

  -- E. Re-verify task still belongs to requested project (project immutability)
  IF v_task.project_id IS DISTINCT FROM v_project_id THEN
    RAISE EXCEPTION 'TASK_PROJECT_CHANGED' USING ERRCODE = 'P4031';
  END IF;

  -- F. Lock active board rows in deterministic order if status changes (or sort_order needs updates)
  IF p_set_status AND v_task.status IS DISTINCT FROM p_status THEN
    PERFORM t.id
    FROM public.tasks t
    WHERE t.project_id = v_project_id
      AND t.status IN ('todo', 'in_progress', 'review', 'done')
    ORDER BY t.status, t.sort_order, t.id
    FOR UPDATE;
  END IF;

  -- Validate assignee if we are updating it
  IF p_set_assignee THEN
    IF p_assignee_user_id IS NOT NULL THEN
      -- Validate assignee belongs to same project and is active & non-client
      SELECT TRUE INTO v_assignee_ok
      FROM public.project_memberships pm
      JOIN public.profiles p ON pm.user_id = p.id
      WHERE pm.project_id = v_project_id
        AND pm.user_id = p_assignee_user_id
        AND p.role != 'client'
        AND p.account_status = 'active';

      IF NOT FOUND OR v_assignee_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'TASK_ASSIGNEE_INVALID_USER' USING ERRCODE = 'P4033';
      END IF;
    END IF;
  END IF;

  -- Validate parent task if we are updating it
  IF p_set_parent_task THEN
    IF p_parent_task_id IS NOT NULL THEN
      IF p_parent_task_id = p_task_id THEN
        RAISE EXCEPTION 'TASK_SELF_PARENT_DENIED' USING ERRCODE = 'P4035';
      END IF;

      SELECT project_id INTO v_parent_task_project
      FROM public.tasks
      WHERE id = p_parent_task_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'PARENT_TASK_NOT_FOUND' USING ERRCODE = 'P4034';
      END IF;

      IF v_parent_task_project IS DISTINCT FROM v_project_id THEN
        RAISE EXCEPTION 'INVALID_PARENT_TASK_PROJECT' USING ERRCODE = 'P4036';
      END IF;
    END IF;
  END IF;

  -- Validate date range logic
  v_effective_start := CASE WHEN p_set_start_date THEN p_start_date ELSE v_task.start_date END;
  v_effective_due := CASE WHEN p_set_due_date THEN p_due_date ELSE v_task.due_date END;

  IF v_effective_start IS NOT NULL AND v_effective_due IS NOT NULL AND v_effective_due < v_effective_start THEN
    RAISE EXCEPTION 'INVALID_TASK_DATE_RANGE' USING ERRCODE = 'P4037';
  END IF;

  -- Compute status-change sort_order if applicable
  v_next_sort_order := v_task.sort_order;
  IF p_set_status AND v_task.status IS DISTINCT FROM p_status THEN
    SELECT COALESCE(MAX(t.sort_order), 0) + 1000
    INTO v_next_sort_order
    FROM public.tasks t
    WHERE t.project_id = v_project_id
      AND t.status = p_status
      AND t.id <> p_task_id;

    -- Set the transaction-local ordering flag before UPDATE
    PERFORM set_config('app.phase4_ordering_write', 'allowed', TRUE);
  END IF;

  -- Perform update
  UPDATE public.tasks
  SET
    parent_task_id = CASE WHEN p_set_parent_task THEN p_parent_task_id ELSE parent_task_id END,
    title = CASE WHEN p_set_title THEN p_title ELSE title END,
    description = CASE WHEN p_set_description THEN p_description ELSE description END,
    status = CASE WHEN p_set_status THEN p_status ELSE status END,
    priority = CASE WHEN p_set_priority THEN p_priority ELSE priority END,
    assignee_user_id = CASE WHEN p_set_assignee THEN p_assignee_user_id ELSE assignee_user_id END,
    start_date = CASE WHEN p_set_start_date THEN p_start_date ELSE start_date END,
    due_date = CASE WHEN p_set_due_date THEN p_due_date ELSE due_date END,
    sort_order = v_next_sort_order,
    updated_by = p_actor_user_id
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

-- Revoke execute from public/anon/authenticated and grant to service_role only
REVOKE ALL ON FUNCTION public.phase4_update_task_atomic(
  UUID, UUID, UUID, BOOLEAN, UUID, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, public.task_status, BOOLEAN, public.task_priority, BOOLEAN, UUID, BOOLEAN, DATE, BOOLEAN, DATE
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase4_update_task_atomic(
  UUID, UUID, UUID, BOOLEAN, UUID, BOOLEAN, TEXT, BOOLEAN, TEXT, BOOLEAN, public.task_status, BOOLEAN, public.task_priority, BOOLEAN, UUID, BOOLEAN, DATE, BOOLEAN, DATE
) TO service_role;
