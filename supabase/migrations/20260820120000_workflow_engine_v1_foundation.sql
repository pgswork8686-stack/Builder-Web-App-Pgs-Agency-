-- ============================================================
-- Migration: Workflow Engine V1 Foundation & Runtime Schema
-- Timestamp: 20260820120000_workflow_engine_v1_foundation.sql
-- Purpose:
--   1. Implements core Workflow Template & Runtime database tables.
--   2. Strict RLS enabled (Backend-only / Service role access).
--   3. All functions are SECURITY INVOKER with explicit search_path.
--   4. Links to existing Service Delivery Items and Tasks seamlessly.
-- ============================================================

-- 1. Sequences for human-readable business codes
CREATE SEQUENCE IF NOT EXISTS public.seq_workflow_template_code START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_workflow_stage_code START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_project_workflow_code START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_project_workflow_stage_code START 1;

-- 2. workflow_templates
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code TEXT NOT NULL UNIQUE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_templates_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT workflow_templates_service_version_unique
    UNIQUE (service_id, version)
);

-- Partial index: only 1 default published workflow template per service
CREATE UNIQUE INDEX IF NOT EXISTS uidx_workflow_templates_default_published
  ON public.workflow_templates (service_id)
  WHERE (status = 'published' AND is_default = true);

-- 3. workflow_template_stages
CREATE TABLE IF NOT EXISTS public.workflow_template_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code TEXT NOT NULL UNIQUE,
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sla_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_template_stages_sort_order_unique
    UNIQUE (workflow_template_id, sort_order)
);

-- 4. workflow_template_stage_items (Mapping Delivery Items into Stages)
CREATE TABLE IF NOT EXISTS public.workflow_template_stage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_stage_id UUID NOT NULL REFERENCES public.workflow_template_stages(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  service_delivery_item_id UUID NOT NULL REFERENCES public.service_delivery_items(id) ON DELETE RESTRICT,
  service_delivery_item_code TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_scope TEXT DEFAULT 'internal',
  sla_hours INTEGER,
  auto_create_task BOOLEAN NOT NULL DEFAULT false,
  completion_mode TEXT NOT NULL DEFAULT 'tasks_done',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_template_stage_items_completion_mode_check
    CHECK (completion_mode IN ('manual', 'tasks_done', 'tasks_done_and_approval')),
  CONSTRAINT workflow_template_stage_items_approval_scope_check
    CHECK (approval_scope IS NULL OR approval_scope IN ('internal', 'client', 'both')),
  CONSTRAINT workflow_template_stage_items_unique_item_per_template
    UNIQUE (workflow_template_id, service_delivery_item_id)
);

-- 5. workflow_template_stage_dependencies (Finish-to-Start Stage DAG)
CREATE TABLE IF NOT EXISTS public.workflow_template_stage_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  predecessor_stage_id UUID NOT NULL REFERENCES public.workflow_template_stages(id) ON DELETE CASCADE,
  successor_stage_id UUID NOT NULL REFERENCES public.workflow_template_stages(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_template_stage_deps_no_self_ref
    CHECK (predecessor_stage_id <> successor_stage_id),
  CONSTRAINT workflow_template_stage_deps_unique
    UNIQUE (predecessor_stage_id, successor_stage_id)
);

-- 6. workflow_template_item_dependencies (Finish-to-Start Item DAG)
CREATE TABLE IF NOT EXISTS public.workflow_template_item_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  predecessor_stage_item_id UUID NOT NULL REFERENCES public.workflow_template_stage_items(id) ON DELETE CASCADE,
  successor_stage_item_id UUID NOT NULL REFERENCES public.workflow_template_stage_items(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_template_item_deps_no_self_ref
    CHECK (predecessor_stage_item_id <> successor_stage_item_id),
  CONSTRAINT workflow_template_item_deps_unique
    UNIQUE (predecessor_stage_item_id, successor_stage_item_id)
);

-- 7. project_workflows (Runtime snapshot for project services)
CREATE TABLE IF NOT EXISTS public.project_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_code TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_code TEXT,
  project_service_id UUID NOT NULL REFERENCES public.project_services(id) ON DELETE CASCADE UNIQUE,
  project_service_code TEXT,
  source_workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  source_workflow_code TEXT,
  source_workflow_version INTEGER,
  name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflows_status_check
    CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'))
);

-- 8. project_workflow_stages (Runtime stages)
CREATE TABLE IF NOT EXISTS public.project_workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_stage_code TEXT NOT NULL UNIQUE,
  project_workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  source_template_stage_id UUID REFERENCES public.workflow_template_stages(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  description_snapshot TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sla_hours_snapshot INTEGER,
  status TEXT NOT NULL DEFAULT 'locked',
  started_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflow_stages_status_check
    CHECK (status IN ('locked', 'ready', 'in_progress', 'completed', 'skipped'))
);

-- 9. project_workflow_stage_items (Runtime stage items mapping Project Service Items)
CREATE TABLE IF NOT EXISTS public.project_workflow_stage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_stage_id UUID NOT NULL REFERENCES public.project_workflow_stages(id) ON DELETE CASCADE,
  project_workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  project_service_item_id UUID NOT NULL REFERENCES public.project_service_items(id) ON DELETE CASCADE UNIQUE,
  project_service_item_code TEXT,
  source_template_stage_item_id UUID REFERENCES public.workflow_template_stage_items(id) ON DELETE SET NULL,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_scope TEXT DEFAULT 'internal',
  sla_hours_snapshot INTEGER,
  completion_mode TEXT NOT NULL DEFAULT 'tasks_done',
  auto_create_task BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ready',
  started_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflow_stage_items_status_check
    CHECK (status IN ('locked', 'ready', 'in_progress', 'pending_approval', 'completed', 'blocked', 'skipped'))
);

-- 10. project_workflow_task_links (Link Tasks to Workflow Stage Items)
CREATE TABLE IF NOT EXISTS public.project_workflow_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_stage_item_id UUID NOT NULL REFERENCES public.project_workflow_stage_items(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'primary',
  created_by_workflow BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflow_task_links_link_type_check
    CHECK (link_type IN ('primary', 'supporting')),
  CONSTRAINT project_workflow_task_links_unique
    UNIQUE (project_workflow_stage_item_id, task_id)
);

-- 11. workflow_approval_requests (Internal & Client Approvals)
CREATE TABLE IF NOT EXISTS public.workflow_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_code TEXT,
  project_workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  project_workflow_stage_id UUID REFERENCES public.project_workflow_stages(id) ON DELETE CASCADE,
  project_workflow_stage_item_id UUID REFERENCES public.project_workflow_stage_items(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'pending',
  approver_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_note TEXT,
  decision_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_approval_requests_type_check
    CHECK (approval_type IN ('internal', 'client')),
  CONSTRAINT workflow_approval_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- 12. Enable RLS on all workflow tables (Backend-only / Service role access)
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_stage_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_stage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approval_requests ENABLE ROW LEVEL SECURITY;

-- Revoke direct permissions from public/anon/authenticated roles
REVOKE ALL ON public.workflow_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stage_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_stage_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_template_item_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_stages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_stage_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_task_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_approval_requests FROM PUBLIC, anon, authenticated;

-- Grant full access to service_role (used exclusively by NestJS API)
GRANT ALL ON public.workflow_templates TO service_role;
GRANT ALL ON public.workflow_template_stages TO service_role;
GRANT ALL ON public.workflow_template_stage_items TO service_role;
GRANT ALL ON public.workflow_template_stage_dependencies TO service_role;
GRANT ALL ON public.workflow_template_item_dependencies TO service_role;
GRANT ALL ON public.project_workflows TO service_role;
GRANT ALL ON public.project_workflow_stages TO service_role;
GRANT ALL ON public.project_workflow_stage_items TO service_role;
GRANT ALL ON public.project_workflow_task_links TO service_role;
GRANT ALL ON public.workflow_approval_requests TO service_role;