-- ============================================================
-- Phase 4: Project execution workspace
-- Git-only migration. External review applies it to Supabase DEV.
-- Extends Phase 3 with comments, private file metadata/upload
-- sessions, board ordering and calendar query indexes.
-- ============================================================

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL
    REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_comments_content_valid
    CHECK (length(btrim(content)) BETWEEN 1 AND 10000)
);

CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID
    REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  file_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_files_private_bucket_only
    CHECK (storage_bucket = 'project-files'),
  CONSTRAINT project_files_original_name_valid
    CHECK (length(btrim(original_name)) BETWEEN 1 AND 255),
  CONSTRAINT project_files_size_valid
    CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  CONSTRAINT project_files_mime_valid CHECK (
    mime_type = ANY (ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]::TEXT[])
  )
);

-- A short-lived server-owned session binds a signed upload to one actor,
-- project, optional task, path, MIME type and size before finalization.
CREATE TABLE public.file_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID
    REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_bucket TEXT NOT NULL DEFAULT 'project-files',
  storage_path TEXT NOT NULL UNIQUE,
  expected_name TEXT NOT NULL,
  expected_mime TEXT NOT NULL,
  expected_size BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT file_upload_sessions_private_bucket_only
    CHECK (storage_bucket = 'project-files'),
  CONSTRAINT file_upload_sessions_name_valid
    CHECK (length(btrim(expected_name)) BETWEEN 1 AND 255),
  CONSTRAINT file_upload_sessions_size_valid
    CHECK (expected_size > 0 AND expected_size <= 26214400),
  CONSTRAINT file_upload_sessions_expiry_valid
    CHECK (expires_at > created_at),
  CONSTRAINT file_upload_sessions_mime_valid CHECK (
    expected_mime = ANY (ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]::TEXT[])
  )
);

-- Keep task-linked file rows and upload sessions scoped to the same project
-- as their task. NestJS checks this first for safe client errors; this trigger
-- is the database boundary against cross-project confusion.
CREATE OR REPLACE FUNCTION public.phase4_validate_file_task_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task_project_id UUID;
BEGIN
  IF NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.project_id
  INTO v_task_project_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_TASK_NOT_FOUND' USING ERRCODE = 'P4001';
  END IF;
  IF v_task_project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'FILE_TASK_PROJECT_MISMATCH' USING ERRCODE = 'P4002';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase4_validate_project_file_task
  BEFORE INSERT OR UPDATE OF project_id, task_id ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.phase4_validate_file_task_project();

CREATE TRIGGER trigger_phase4_validate_upload_session_task
  BEFORE INSERT OR UPDATE OF project_id, task_id ON public.file_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.phase4_validate_file_task_project();

CREATE TRIGGER trigger_set_updated_at_task_comments
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_project_files
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_file_upload_sessions
  BEFORE UPDATE ON public.file_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalize existing Phase 3 task ordering once. Subsequent inserts and
-- ordinary status changes get a transactionally assigned 1000-point rank.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, status
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) * 1000 AS normalized_sort_order
  FROM public.tasks
)
UPDATE public.tasks AS task
SET sort_order = ranked.normalized_sort_order
FROM ranked
WHERE ranked.id = task.id;

CREATE OR REPLACE FUNCTION public.phase4_assign_task_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::TEXT, 0));
    SELECT COALESCE(MAX(t.sort_order), 0) + 1000
    INTO NEW.sort_order
    FROM public.tasks t
    WHERE t.project_id = NEW.project_id
      AND t.status = NEW.status;
  ELSIF (
    NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.status IS DISTINCT FROM OLD.status
  ) AND NEW.sort_order IS NOT DISTINCT FROM OLD.sort_order THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::TEXT, 0));
    SELECT COALESCE(MAX(t.sort_order), 0) + 1000
    INTO NEW.sort_order
    FROM public.tasks t
    WHERE t.project_id = NEW.project_id
      AND t.status = NEW.status
      AND t.id <> NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase4_assign_task_sort_order
  BEFORE INSERT OR UPDATE OF project_id, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.phase4_assign_task_sort_order();

-- Board moves are serialized per project, validate both neighbors, and
-- transactionally normalize the target column to deterministic increments of
-- 1000. The board API caps active tasks at 500, so normalization never scans
-- an unbounded project history.
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

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;
  IF NOT FOUND OR v_task.status = 'cancelled' THEN
    RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_task.project_id::TEXT, 0));

  -- Lock every active board row in stable order while calculating the move.
  PERFORM t.id
  FROM public.tasks t
  WHERE t.project_id = v_task.project_id
    AND t.status IN ('todo', 'in_progress', 'review', 'done')
  ORDER BY t.status, t.sort_order, t.id
  FOR UPDATE;

  IF p_before_task_id IS NOT NULL THEN
    SELECT * INTO v_neighbor
    FROM public.tasks
    WHERE id = p_before_task_id
      AND project_id = v_task.project_id
      AND status = p_target_status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
    END IF;
  END IF;

  IF p_after_task_id IS NOT NULL THEN
    SELECT * INTO v_neighbor
    FROM public.tasks
    WHERE id = p_after_task_id
      AND project_id = v_task.project_id
      AND status = p_target_status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'KANBAN_TARGET_INVALID' USING ERRCODE = 'P4010';
    END IF;
  END IF;

  SELECT COALESCE(array_agg(t.id ORDER BY t.sort_order ASC, t.id ASC), ARRAY[]::UUID[])
  INTO v_ordered_ids
  FROM public.tasks t
  WHERE t.project_id = v_task.project_id
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

  -- Move to a collision-free temporary rank, then normalize all target rows.
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

-- Finalization is an atomic metadata/session transaction after NestJS has
-- verified the Storage object. Retry returns the existing metadata row.
CREATE OR REPLACE FUNCTION public.phase4_finalize_project_file(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS public.project_files
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.file_upload_sessions%ROWTYPE;
  v_file public.project_files%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.file_upload_sessions
  WHERE id = p_session_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_UPLOAD_SESSION_NOT_FOUND' USING ERRCODE = 'P4020';
  END IF;

  IF v_session.completed_at IS NOT NULL THEN
    SELECT * INTO v_file
    FROM public.project_files
    WHERE storage_path = v_session.storage_path;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FILE_FINALIZE_INVALID' USING ERRCODE = 'P4022';
    END IF;
    RETURN v_file;
  END IF;

  IF v_session.expires_at <= NOW() THEN
    RAISE EXCEPTION 'FILE_UPLOAD_SESSION_EXPIRED' USING ERRCODE = 'P4021';
  END IF;

  INSERT INTO public.project_files (
    project_id,
    task_id,
    uploaded_by,
    storage_bucket,
    storage_path,
    original_name,
    mime_type,
    size_bytes
  ) VALUES (
    v_session.project_id,
    v_session.task_id,
    v_session.user_id,
    v_session.storage_bucket,
    v_session.storage_path,
    v_session.expected_name,
    v_session.expected_mime,
    v_session.expected_size
  )
  RETURNING * INTO v_file;

  UPDATE public.file_upload_sessions
  SET completed_at = NOW()
  WHERE id = v_session.id;

  RETURN v_file;
END;
$$;

CREATE INDEX task_comments_task_created_idx
  ON public.task_comments (task_id, created_at ASC, id ASC);
CREATE INDEX task_comments_author_idx
  ON public.task_comments (author_user_id);

CREATE INDEX project_files_project_created_idx
  ON public.project_files (project_id, created_at DESC, id DESC);
CREATE INDEX project_files_task_idx
  ON public.project_files (task_id);
CREATE INDEX project_files_uploaded_by_idx
  ON public.project_files (uploaded_by);

CREATE INDEX file_upload_sessions_user_expires_idx
  ON public.file_upload_sessions (user_id, expires_at DESC);
CREATE INDEX file_upload_sessions_project_idx
  ON public.file_upload_sessions (project_id);
CREATE INDEX file_upload_sessions_task_idx
  ON public.file_upload_sessions (task_id);

CREATE UNIQUE INDEX tasks_project_status_sort_unique_idx
  ON public.tasks (project_id, status, sort_order);
CREATE INDEX tasks_project_calendar_start_idx
  ON public.tasks (project_id, start_date, id)
  WHERE start_date IS NOT NULL;
CREATE INDEX tasks_project_calendar_due_idx
  ON public.tasks (project_id, due_date, id)
  WHERE due_date IS NOT NULL;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_upload_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.task_comments,
  public.project_files,
  public.file_upload_sessions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.task_comments,
  public.project_files,
  public.file_upload_sessions
TO service_role;

REVOKE ALL ON FUNCTION public.phase4_validate_file_task_project()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_assign_task_sort_order()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_task_on_board(
  UUID, public.task_status, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase4_finalize_project_file(UUID, UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase4_validate_file_task_project()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_assign_task_sort_order()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.move_task_on_board(
  UUID, public.task_status, UUID, UUID, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4_finalize_project_file(UUID, UUID)
  TO service_role;

-- Private by default; signed upload/download URLs are minted only by NestJS.
-- No browser storage.objects policies are created.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'project-files',
  'project-files',
  FALSE,
  26214400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::TEXT[]
) ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
