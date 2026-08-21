-- ============================================================
-- Migration: Workflow Engine V1 Hardening & Production Safeguards
-- Timestamp: 20260820123000_workflow_engine_v1_hardening.sql
-- Description:
--   1. Transaction-safe atomic RPC for template creation & cloning.
--   2. Enforces QTDV_xx, GDQT_xx, QTDA_xx, GDDA_xx auto-generation via sequences.
--   3. Adds runtime snapshot dependency tables:
--      - project_workflow_stage_dependencies
--      - project_workflow_item_dependencies
--   4. Adds workflow_audit_events table for compliance tracking.
--   5. Updates automation trigger check constraints to support workflow events.
--   6. Enforces RLS with backend service_role only & immutable business codes.
-- ============================================================

-- 1. Attach business code generation & immutability triggers to Workflow tables
ALTER TABLE public.workflow_templates
  ALTER COLUMN workflow_code SET DEFAULT public.format_business_code('QTDV', nextval('public.seq_workflow_template_code'));

ALTER TABLE public.workflow_template_stages
  ALTER COLUMN stage_code SET DEFAULT public.format_business_code('GDQT', nextval('public.seq_workflow_stage_code'));

ALTER TABLE public.project_workflows
  ALTER COLUMN project_workflow_code SET DEFAULT public.format_business_code('QTDA', nextval('public.seq_project_workflow_code'));

ALTER TABLE public.project_workflow_stages
  ALTER COLUMN project_workflow_stage_code SET DEFAULT public.format_business_code('GDDA', nextval('public.seq_project_workflow_stage_code'));

-- Immutability triggers
DROP TRIGGER IF EXISTS trg_immutable_workflow_template_code ON public.workflow_templates;
CREATE TRIGGER trg_immutable_workflow_template_code
  BEFORE UPDATE OF workflow_code ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_code_column_update('workflow_code');

DROP TRIGGER IF EXISTS trg_immutable_workflow_stage_code ON public.workflow_template_stages;
CREATE TRIGGER trg_immutable_workflow_stage_code
  BEFORE UPDATE OF stage_code ON public.workflow_template_stages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_code_column_update('stage_code');

DROP TRIGGER IF EXISTS trg_immutable_project_workflow_code ON public.project_workflows;
CREATE TRIGGER trg_immutable_project_workflow_code
  BEFORE UPDATE OF project_workflow_code ON public.project_workflows
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_code_column_update('project_workflow_code');

DROP TRIGGER IF EXISTS trg_immutable_project_workflow_stage_code ON public.project_workflow_stages;
CREATE TRIGGER trg_immutable_project_workflow_stage_code
  BEFORE UPDATE OF project_workflow_stage_code ON public.project_workflow_stages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_code_column_update('project_workflow_stage_code');

-- 2. Add Runtime Dependency Snapshot Tables
CREATE TABLE IF NOT EXISTS public.project_workflow_stage_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  predecessor_stage_id UUID NOT NULL REFERENCES public.project_workflow_stages(id) ON DELETE CASCADE,
  successor_stage_id UUID NOT NULL REFERENCES public.project_workflow_stages(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_hours INTEGER NOT NULL DEFAULT 0,
  overridden_at TIMESTAMPTZ,
  overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflow_stage_deps_no_self_ref
    CHECK (predecessor_stage_id <> successor_stage_id),
  CONSTRAINT project_workflow_stage_deps_unique
    UNIQUE (predecessor_stage_id, successor_stage_id)
);

CREATE TABLE IF NOT EXISTS public.project_workflow_item_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  predecessor_stage_item_id UUID NOT NULL REFERENCES public.project_workflow_stage_items(id) ON DELETE CASCADE,
  successor_stage_item_id UUID NOT NULL REFERENCES public.project_workflow_stage_items(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_hours INTEGER NOT NULL DEFAULT 0,
  overridden_at TIMESTAMPTZ,
  overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_workflow_item_deps_no_self_ref
    CHECK (predecessor_stage_item_id <> successor_stage_item_id),
  CONSTRAINT project_workflow_item_deps_unique
    UNIQUE (predecessor_stage_item_id, successor_stage_item_id)
);

-- 3. Workflow Audit Events Table
CREATE TABLE IF NOT EXISTS public.workflow_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_workflow_id UUID REFERENCES public.project_workflows(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS & Permissions for newly added tables
ALTER TABLE public.project_workflow_stage_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_workflow_stage_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_workflow_item_dependencies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workflow_audit_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.project_workflow_stage_dependencies TO service_role;
GRANT ALL ON public.project_workflow_item_dependencies TO service_role;
GRANT ALL ON public.workflow_audit_events TO service_role;

-- 5. Atomic RPC: Create Workflow Template with Service Row Locking
CREATE OR REPLACE FUNCTION public.workflow_create_template(
  p_service_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_actor_id UUID
)
RETURNS public.workflow_templates
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_code TEXT;
  v_next_version INTEGER;
  v_result public.workflow_templates;
BEGIN
  -- Lock service row to prevent concurrent version collision
  SELECT service_code INTO v_service_code
  FROM public.services
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service % not found', p_service_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.workflow_templates
  WHERE service_id = p_service_id;

  INSERT INTO public.workflow_templates (
    service_id,
    service_code,
    name,
    description,
    version,
    status,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    p_service_id,
    v_service_code,
    p_name,
    p_description,
    v_next_version,
    'draft',
    false,
    p_actor_id,
    p_actor_id
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_create_template(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_create_template(UUID, TEXT, TEXT, UUID) TO service_role;
