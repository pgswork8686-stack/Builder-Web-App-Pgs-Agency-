-- ============================================================
-- Phase 3: Projects / Project Memberships / Services / Tasks
-- Git-only migration. External review applies it to Supabase DEV.
-- Requires public.profiles, public.client_companies,
-- public.client_memberships and public.set_updated_at().
-- ============================================================

CREATE TYPE public.project_status AS ENUM (
  'draft', 'active', 'on_hold', 'completed', 'cancelled'
);
CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.project_member_role AS ENUM (
  'project_manager', 'member', 'client_contact', 'viewer'
);
CREATE TYPE public.project_service_status AS ENUM (
  'planned', 'active', 'paused', 'completed', 'cancelled'
);
CREATE TYPE public.task_status AS ENUM (
  'todo', 'in_progress', 'review', 'done', 'cancelled'
);
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,
  client_company_id UUID NOT NULL
    REFERENCES public.client_companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status NOT NULL DEFAULT 'draft',
  priority public.project_priority NOT NULL DEFAULT 'medium',
  project_manager_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_code_not_blank
    CHECK (length(btrim(project_code)) BETWEEN 2 AND 40),
  CONSTRAINT projects_code_normalized
    CHECK (project_code = upper(btrim(project_code))),
  CONSTRAINT projects_name_not_blank
    CHECK (length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT projects_date_range_valid
    CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date)
);

CREATE TABLE public.project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_role public.project_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_memberships_project_user_unique
    UNIQUE (project_id, user_id)
);

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT services_code_not_blank
    CHECK (length(btrim(code)) BETWEEN 2 AND 40),
  CONSTRAINT services_code_normalized
    CHECK (code = upper(btrim(code))),
  CONSTRAINT services_name_not_blank
    CHECK (length(btrim(name)) BETWEEN 2 AND 160)
);

CREATE TABLE public.project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id UUID NOT NULL
    REFERENCES public.services(id) ON DELETE RESTRICT,
  status public.project_service_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_services_project_service_unique
    UNIQUE (project_id, service_id),
  CONSTRAINT project_services_date_range_valid
    CHECK (started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id UUID
    REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_user_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_title_not_blank
    CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  CONSTRAINT tasks_date_range_valid
    CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
  CONSTRAINT tasks_not_own_parent
    CHECK (parent_task_id IS NULL OR parent_task_id <> id)
);

-- Preserve completion history. Entering the completed state stamps the first
-- completion time; leaving the state does not erase that historical value.
CREATE OR REPLACE FUNCTION public.phase3_set_completion_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'projects'
     AND NEW.status = 'completed'
     AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  ELSIF TG_TABLE_NAME = 'tasks'
     AND NEW.status = 'done'
     AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase3_project_completion
  BEFORE INSERT OR UPDATE OF status, completed_at ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.phase3_set_completion_timestamps();

CREATE TRIGGER trigger_phase3_task_completion
  BEFORE INSERT OR UPDATE OF status, completed_at ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.phase3_set_completion_timestamps();

-- Validate global role, active state and client-company isolation for every
-- project membership. Also protect the primary PM membership from deletion or
-- role demotion while projects.project_manager_user_id points to it.
CREATE OR REPLACE FUNCTION public.phase3_validate_project_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_global_role public.app_role;
  v_account_status public.account_status;
  v_client_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = OLD.project_id
        AND p.project_manager_user_id = OLD.user_id
    ) THEN
      RAISE EXCEPTION 'PRIMARY_PROJECT_MANAGER_MEMBERSHIP_REQUIRED'
        USING ERRCODE = 'P3008';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.project_id = OLD.project_id
        AND t.assignee_user_id = OLD.user_id
    ) THEN
      RAISE EXCEPTION 'PROJECT_MEMBER_HAS_ASSIGNED_TASKS'
        USING ERRCODE = 'P3014';
    END IF;
    RETURN OLD;
  END IF;

  SELECT p.client_company_id
  INTO v_client_company_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P3001';
  END IF;

  SELECT p.role, p.account_status
  INTO v_global_role, v_account_status
  FROM public.profiles p
  WHERE p.id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P3002';
  END IF;
  IF v_account_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = 'P3003';
  END IF;

  IF NEW.project_role IN ('project_manager', 'member')
     AND v_global_role = 'client' THEN
    RAISE EXCEPTION 'INVALID_PROJECT_MEMBER_ROLE' USING ERRCODE = 'P3004';
  END IF;

  IF NEW.project_role = 'client_contact' THEN
    IF v_global_role IS DISTINCT FROM 'client' THEN
      RAISE EXCEPTION 'INVALID_PROJECT_MEMBER_ROLE' USING ERRCODE = 'P3004';
    END IF;
  END IF;

  -- Every client attached to a project, including a viewer, must belong to
  -- the same client company. Internal viewers remain valid.
  IF v_global_role = 'client' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.client_memberships cm
      WHERE cm.user_id = NEW.user_id
        AND cm.client_company_id = v_client_company_id
    ) THEN
      RAISE EXCEPTION 'CLIENT_CONTACT_COMPANY_MISMATCH'
        USING ERRCODE = 'P3005';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND EXISTS (
       SELECT 1 FROM public.projects p
       WHERE p.id = OLD.project_id
         AND p.project_manager_user_id = OLD.user_id
     )
     AND (
       NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.project_role IS DISTINCT FROM 'project_manager'
     ) THEN
    RAISE EXCEPTION 'PRIMARY_PROJECT_MANAGER_MEMBERSHIP_REQUIRED'
      USING ERRCODE = 'P3008';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase3_validate_project_membership
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_memberships
  FOR EACH ROW EXECUTE FUNCTION public.phase3_validate_project_membership();

-- Changing a project's client company cannot strand existing client
-- memberships outside their authorized company scope.
CREATE OR REPLACE FUNCTION public.phase3_validate_project_company_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.client_company_id IS NOT DISTINCT FROM OLD.client_company_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_memberships pm
    JOIN public.profiles profile ON profile.id = pm.user_id
    WHERE pm.project_id = NEW.id
      AND profile.role = 'client'
      AND NOT EXISTS (
        SELECT 1
        FROM public.client_memberships cm
        WHERE cm.user_id = pm.user_id
          AND cm.client_company_id = NEW.client_company_id
      )
  ) THEN
    RAISE EXCEPTION 'CLIENT_CONTACT_COMPANY_MISMATCH'
      USING ERRCODE = 'P3005';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase3_validate_project_company_change
  BEFORE UPDATE OF client_company_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.phase3_validate_project_company_change();

-- The project row and its primary PM membership are updated in the same
-- database statement transaction. A validation failure rolls back both.
CREATE OR REPLACE FUNCTION public.phase3_sync_project_manager_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.project_manager_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_memberships (
    project_id,
    user_id,
    project_role,
    created_by
  ) VALUES (
    NEW.id,
    NEW.project_manager_user_id,
    'project_manager',
    COALESCE(NEW.updated_by, NEW.created_by)
  )
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET project_role = 'project_manager';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase3_sync_project_manager_membership
  AFTER INSERT OR UPDATE OF project_manager_user_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.phase3_sync_project_manager_membership();

-- Task relationships are enforced at the database boundary as defense in
-- depth. NestJS performs the same checks first to return sanitized errors.
CREATE OR REPLACE FUNCTION public.phase3_validate_task_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_project_id UUID;
  v_assignee_role public.app_role;
  v_assignee_status public.account_status;
BEGIN
  IF NEW.assignee_user_id IS NOT NULL THEN
    SELECT profile.role, profile.account_status
    INTO v_assignee_role, v_assignee_status
    FROM public.project_memberships pm
    JOIN public.profiles profile ON profile.id = pm.user_id
    WHERE pm.project_id = NEW.project_id
      AND pm.user_id = NEW.assignee_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER'
        USING ERRCODE = 'P3010';
    END IF;

    IF v_assignee_role = 'client'
       OR v_assignee_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'TASK_ASSIGNEE_INVALID_USER'
        USING ERRCODE = 'P3015';
    END IF;
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'TASK_SELF_PARENT_DENIED' USING ERRCODE = 'P3011';
    END IF;

    SELECT t.project_id
    INTO v_parent_project_id
    FROM public.tasks t
    WHERE t.id = NEW.parent_task_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PARENT_TASK_NOT_FOUND' USING ERRCODE = 'P3012';
    END IF;
    IF v_parent_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'INVALID_PARENT_TASK_PROJECT'
        USING ERRCODE = 'P3013';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_phase3_validate_task_relationships
  BEFORE INSERT OR UPDATE OF project_id, assignee_user_id, parent_task_id
  ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.phase3_validate_task_relationships();

CREATE TRIGGER trigger_set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_project_memberships
  BEFORE UPDATE ON public.project_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_services
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_project_services
  BEFORE UPDATE ON public.project_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Foreign-key and query-shape indexes. Unique indexes already cover
-- projects.project_code, services.code and each project assignment pair.
CREATE INDEX projects_client_company_idx
  ON public.projects (client_company_id);
CREATE INDEX projects_status_idx
  ON public.projects (status);
CREATE INDEX projects_manager_idx
  ON public.projects (project_manager_user_id);
CREATE INDEX projects_created_stable_idx
  ON public.projects (created_at DESC, id DESC);

CREATE INDEX project_memberships_user_idx
  ON public.project_memberships (user_id);
CREATE INDEX project_memberships_role_idx
  ON public.project_memberships (project_role);

CREATE INDEX project_services_service_idx
  ON public.project_services (service_id);
CREATE INDEX project_services_status_idx
  ON public.project_services (status);

CREATE INDEX tasks_project_stable_idx
  ON public.tasks (project_id, sort_order ASC, created_at DESC, id DESC);
CREATE INDEX tasks_assignee_idx
  ON public.tasks (assignee_user_id);
CREATE INDEX tasks_status_idx
  ON public.tasks (status);
CREATE INDEX tasks_priority_idx
  ON public.tasks (priority);
CREATE INDEX tasks_due_date_idx
  ON public.tasks (due_date);
CREATE INDEX tasks_parent_idx
  ON public.tasks (parent_task_id);
CREATE INDEX tasks_created_idx
  ON public.tasks (created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated business policies are created. Browser CRUD remains
-- denied; NestJS uses the service_role system client. Explicit grants avoid
-- depending on Supabase's changing default Data API exposure behavior.
REVOKE ALL ON TABLE
  public.projects,
  public.project_memberships,
  public.services,
  public.project_services,
  public.tasks
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.projects,
  public.project_memberships,
  public.services,
  public.project_services,
  public.tasks
TO service_role;

REVOKE ALL ON FUNCTION public.phase3_set_completion_timestamps()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3_validate_project_membership()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3_sync_project_manager_membership()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3_validate_project_company_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3_validate_task_relationships()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.phase3_set_completion_timestamps()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3_validate_project_membership()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3_sync_project_manager_membership()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3_validate_project_company_change()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3_validate_task_relationships()
  TO service_role;
