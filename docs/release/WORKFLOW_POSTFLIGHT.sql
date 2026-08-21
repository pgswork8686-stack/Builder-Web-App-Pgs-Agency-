-- ================================================================================
-- PGS HUB — WORKFLOW ENGINE V1 POSTFLIGHT VERIFICATION
-- Run after applying workflow engine v1 migrations to verify structural integrity,
-- RLS security enforcement, sequences, constraints, and RPC permissions.
-- ================================================================================

-- 1. Verify all 13 workflow tables exist and have RLS enabled
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
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
  )
ORDER BY c.relname;

-- 2. Verify all 4 business code sequences exist
SELECT c.relname AS sequence_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND c.relname IN (
    'seq_workflow_template_code',
    'seq_workflow_stage_code',
    'seq_project_workflow_code',
    'seq_project_workflow_stage_code'
  )
ORDER BY c.relname;

-- 3. Verify RPC function definitions and search_path security
SELECT 
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'workflow_create_template',
    'workflow_clone_template',
    'workflow_set_default_template',
    'workflow_instantiate_project_service',
    'workflow_create_primary_task',
    'workflow_request_approval',
    'workflow_respond_approval',
    'workflow_add_stage_dependency',
    'workflow_delete_stage_dependency',
    'workflow_add_item_dependency',
    'workflow_delete_item_dependency',
    'workflow_reorder_template_stages'
  )
ORDER BY p.proname;

-- 4. Verify no execute permissions granted to anon or authenticated
SELECT 
  r.rolname,
  p.proname
FROM pg_roles r
CROSS JOIN pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.rolname IN ('anon', 'authenticated')
  AND n.nspname = 'public'
  AND p.proname LIKE 'workflow\_%' ESCAPE '\'
  AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');

-- 5. Verify business code check constraints
SELECT 
  conname,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'c'
  AND conname IN (
    'workflow_templates_business_code_format',
    'workflow_template_stages_business_code_format',
    'project_workflows_business_code_format',
    'project_workflow_stages_business_code_format'
  );
