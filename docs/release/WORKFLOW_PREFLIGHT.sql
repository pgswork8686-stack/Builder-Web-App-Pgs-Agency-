-- ================================================================================
-- PGS HUB — WORKFLOW ENGINE V1 PREFLIGHT VERIFICATION
-- Run before applying workflow engine v1 migrations to ensure the target
-- database meets all structural prerequisites and has no conflicting artifacts.
-- ================================================================================

-- 1. Ensure core Supabase schemas and extensions exist
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'auth', 'storage', 'extensions');

-- 2. Verify prerequisite baseline tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'client_companies',
    'projects',
    'project_memberships',
    'services',
    'service_delivery_items',
    'project_services',
    'project_service_items',
    'tasks'
  )
ORDER BY table_name;

-- 3. Confirm Phase 10 is NOT applied (prevent conflicting state)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'financial_invoices'
) AS phase10_present;

-- 4. Check that no stale workflow tables or conflicting sequences exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
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
    'workflow_audit_events'
  );
