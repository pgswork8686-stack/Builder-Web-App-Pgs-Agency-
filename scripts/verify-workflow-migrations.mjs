import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const PHASE10 = "20260819130000_phase10_all_missing_modules.sql";
const BASELINE_END = "20260819150700";
const WORKFLOW_MIGRATIONS = [
  "20260820120000_workflow_engine_v1_foundation.sql",
  "20260820123000_workflow_engine_v1_hardening.sql",
  "20260820124000_workflow_engine_v1_runtime_hardening.sql",
  "20260820125000_workflow_engine_v1_p2_closure.sql",
];

const WORKFLOW_TABLES = [
  "workflow_templates",
  "workflow_template_stages",
  "workflow_template_stage_items",
  "workflow_template_stage_dependencies",
  "workflow_template_item_dependencies",
  "project_workflows",
  "project_workflow_stages",
  "project_workflow_stage_items",
  "project_workflow_stage_dependencies",
  "project_workflow_item_dependencies",
  "project_workflow_task_links",
  "workflow_approval_requests",
  "workflow_audit_events",
];

const WORKFLOW_SEQUENCES = [
  "seq_workflow_template_code",
  "seq_workflow_stage_code",
  "seq_project_workflow_code",
  "seq_project_workflow_stage_code",
];

const REQUIRED_RPCS = [
  "workflow_create_template",
  "workflow_clone_template",
  "workflow_set_default_template",
  "workflow_instantiate_project_service",
  "workflow_create_primary_task",
  "workflow_request_approval",
  "workflow_respond_approval",
  "workflow_add_stage_dependency",
  "workflow_delete_stage_dependency",
  "workflow_add_item_dependency",
  "workflow_delete_item_dependency",
  "workflow_reorder_template_stages",
];

const REQUIRED_INDEXES = [
  "uidx_workflow_templates_default_published",
  "uidx_project_workflow_task_links_primary",
  "uidx_workflow_approval_pending_item",
  "uidx_workflow_approval_pending_stage",
  "idx_workflow_template_stage_deps_template_successor",
  "idx_workflow_template_item_deps_template_successor",
  "idx_project_workflow_stage_deps_workflow_successor",
  "idx_project_workflow_item_deps_workflow_successor",
];

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required and must point to a disposable PostgreSQL database.",
  );
}

function phase(message) {
  process.stdout.write(`\n=== ${message} ===\n`);
}

function extractCreatedPublicObjects(sql) {
  const objects = new Set();
  const expression =
    /CREATE(?:\s+OR\s+REPLACE)?\s+(?:TABLE|FUNCTION|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)/giu;
  for (const match of sql.matchAll(expression)) {
    objects.add(match[1].toLowerCase());
  }
  return objects;
}

async function loadManifest() {
  const allFiles = (await readdir(MIGRATIONS_DIR))
    .filter((file) => /^\d{14}_.+\.sql$/u.test(file))
    .sort();

  for (const file of WORKFLOW_MIGRATIONS) {
    assert(
      allFiles.includes(file),
      `Required Workflow migration missing: ${file}`,
    );
  }

  const baseline = allFiles.filter(
    (file) => file.slice(0, 14) <= BASELINE_END && file !== PHASE10,
  );
  const manifest = [...baseline, ...WORKFLOW_MIGRATIONS];

  assert(!manifest.includes(PHASE10), "Phase10 entered the Workflow manifest");
  assert.equal(
    new Set(manifest).size,
    manifest.length,
    "Workflow manifest contains duplicate migrations",
  );

  const baselineSource = (
    await Promise.all(
      baseline.map((file) => readFile(join(MIGRATIONS_DIR, file), "utf8")),
    )
  ).join("\n");
  let phase10Source = "";
  try {
    phase10Source = await readFile(join(MIGRATIONS_DIR, PHASE10), "utf8");
  } catch {
    phase10Source = await readFile(join(ROOT, "supabase", `${PHASE10}.excluded`), "utf8");
  }
  const workflowSource = (
    await Promise.all(
      WORKFLOW_MIGRATIONS.map((file) =>
        readFile(join(MIGRATIONS_DIR, file), "utf8"),
      ),
    )
  ).join("\n");

  const baselineObjects = extractCreatedPublicObjects(baselineSource);
  const phase10OnlyObjects = [
    ...extractCreatedPublicObjects(phase10Source),
  ].filter((name) => !baselineObjects.has(name));
  const hiddenDependencies = phase10OnlyObjects.filter((name) =>
    new RegExp(`\\bpublic\\.${name}\\b`, "iu").test(workflowSource),
  );
  assert.deepEqual(
    hiddenDependencies,
    [],
    `Workflow source references Phase10-only objects: ${hiddenDependencies.join(", ")}`,
  );

  return manifest;
}

async function bootstrapSupabaseSurface(client) {
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;

    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      phone TEXT,
      email_confirmed_at TIMESTAMPTZ,
      phone_confirmed_at TIMESTAMPTZ,
      raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      is_super_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $$
      SELECT COALESCE(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        '00000000-0000-0000-0000-000000000000'
      )::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $$
      SELECT COALESCE(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        'anon'
      )
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS JSONB
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $$
      SELECT COALESCE(
        nullif(current_setting('request.jwt.claims', true), ''),
        '{}'
      )::jsonb
    $$;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      public BOOLEAN DEFAULT false,
      avif_autodetection BOOLEAN DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[],
      owner_id TEXT
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT REFERENCES storage.buckets(id),
      name TEXT,
      owner UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      last_accessed_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB,
      path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
      version TEXT,
      owner_id TEXT
    );

    ALTER TABLE storage.objects DISABLE TRIGGER ALL;
    ALTER TABLE storage.buckets DISABLE TRIGGER ALL;
    DELETE FROM storage.objects;
    DELETE FROM storage.buckets;
    ALTER TABLE storage.objects ENABLE TRIGGER ALL;
    ALTER TABLE storage.buckets ENABLE TRIGGER ALL;
    DELETE FROM auth.users;

    CREATE TABLE supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      statements TEXT[],
      name TEXT
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
      END IF;
    END
    $$;

    ALTER ROLE service_role BYPASSRLS;

    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    GRANT ALL ON SCHEMA public, auth, storage TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth, storage TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA auth, storage TO service_role;

    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT EXECUTE ON FUNCTIONS TO service_role;
  `);
}

async function applyMigrations(client, manifest) {
  let applied = 0;
  for (const file of manifest) {
    const source = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`Applying ${file}\n`);
    try {
      await client.query(source);
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations(version, statements, name)
         VALUES ($1, ARRAY[$2], $3)`,
        [file.slice(0, 14), source, file.slice(15, -4)],
      );
      applied += 1;
    } catch (error) {
      error.message = `Migration failed: ${file}\n${error.message}`;
      throw error;
    }
  }
  await client.query(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  `);
  assert.equal(applied, manifest.length);
  process.stdout.write(
    `Applied ${applied} migrations from a clean database.\n`,
  );
}

async function assertSchema(client) {
  const tables = await client.query(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
     ORDER BY c.relname`,
    [WORKFLOW_TABLES],
  );
  assert.equal(tables.rowCount, WORKFLOW_TABLES.length);
  assert(
    tables.rows.every((row) => row.relrowsecurity),
    "Every Workflow business table must have RLS enabled",
  );

  const sequences = await client.query(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
       AND c.relname = ANY($1::text[])`,
    [WORKFLOW_SEQUENCES],
  );
  assert.equal(sequences.rowCount, WORKFLOW_SEQUENCES.length);

  const eligibleColumns = await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'eligible_at'
      AND table_name IN (
        'project_workflow_stage_dependencies',
        'project_workflow_item_dependencies'
      )
  `);
  assert.equal(eligibleColumns.rowCount, 2);

  const functions = await client.query(`
    SELECT
      p.oid::regprocedure::text AS identity,
      p.proname,
      p.prosecdef,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'workflow\\_%' ESCAPE '\\'
        OR p.proname IN (
          'prevent_published_workflow_graph_mutation',
          'validate_workflow_runtime_ownership'
        )
      )
    ORDER BY p.proname, identity
  `);
  const functionNames = new Set(functions.rows.map((row) => row.proname));
  for (const name of REQUIRED_RPCS) {
    assert(functionNames.has(name), `Missing Workflow RPC: ${name}`);
  }
  assert(
    functions.rows.every((row) => !row.prosecdef),
    "Workflow functions must be SECURITY INVOKER",
  );
  assert(
    functions.rows.every((row) =>
      (row.proconfig ?? []).some((value) => value.startsWith("search_path=")),
    ),
    "Workflow functions must have a fixed search_path",
  );

  const indexes = await client.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [REQUIRED_INDEXES],
  );
  assert.equal(indexes.rowCount, REQUIRED_INDEXES.length);

  const codeChecks = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'c'
      AND conrelid IN (
        'public.workflow_templates'::regclass,
        'public.workflow_template_stages'::regclass,
        'public.project_workflows'::regclass,
        'public.project_workflow_stages'::regclass
      )
      AND pg_get_constraintdef(oid) LIKE '%~%'
  `);
  assert.equal(codeChecks.rowCount, 4, "Expected four Workflow code checks");

  const guardTriggers = await client.query(`
    SELECT DISTINCT c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND p.proname IN (
        'workflow_guard_template_lifecycle',
        'workflow_guard_draft_template_graph',
        'prevent_published_workflow_graph_mutation'
      )
  `);
  assert.equal(
    guardTriggers.rowCount,
    5,
    "Published graph mutation guard must cover Template and four child tables",
  );

  const ownershipTriggers = await client.query(`
    SELECT DISTINCT c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND (
        p.proname LIKE 'workflow_validate%ownership'
        OR p.proname = 'validate_workflow_runtime_ownership'
      )
  `);
  assert(
    ownershipTriggers.rowCount >= 4,
    "Runtime ownership guard must cover the risky redundant-owner tables",
  );
}

async function expectDatabaseError(action, accepted, label) {
  try {
    await action();
  } catch (error) {
    const text = `${error.code ?? ""} ${error.message ?? ""}`;
    if (accepted.some((value) => text.includes(value))) {
      return error;
    }
    throw new Error(`${label} failed with an unexpected error: ${text}`);
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function assertRoleIsolation(client) {
  for (const role of ["anon", "authenticated"]) {
    await client.query(`SET ROLE ${role}`);
    try {
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.workflow_templates LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Workflow SELECT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            `INSERT INTO public.workflow_templates
               (workflow_code, service_id, name)
             VALUES ('QTDV_999999', gen_random_uuid(), 'forbidden')`,
          ),
        ["42501", "permission denied"],
        `${role} direct Workflow INSERT`,
      );
    } finally {
      await client.query("RESET ROLE");
    }
  }

  const browserFunctionAccess = await client.query(`
    SELECT r.rolname, p.oid::regprocedure::text AS identity
    FROM pg_roles r
    CROSS JOIN pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE r.rolname IN ('anon', 'authenticated')
      AND n.nspname = 'public'
      AND p.proname LIKE 'workflow\\_%' ESCAPE '\\'
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  `);
  assert.equal(
    browserFunctionAccess.rowCount,
    0,
    "Browser roles must not execute Workflow RPCs",
  );

  await client.query("SET ROLE service_role");
  try {
    const serviceRead = await client.query(
      "SELECT count(*)::integer AS count FROM public.workflow_templates",
    );
    assert.equal(serviceRead.rows[0].count, 0);
  } finally {
    await client.query("RESET ROLE");
  }
}

async function seedDisposableData(client) {
  await client.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
     VALUES ($1, 'test-admin@example.invalid', '{"full_name":"TEST_ADMIN"}'::jsonb, '{}'::jsonb)`,
    [ADMIN_ID],
  );

  await client.query(`SELECT public.bootstrap_initial_admin($1::uuid)`, [
    ADMIN_ID,
  ]);

  const companyResult = await client.query(
    `INSERT INTO public.client_companies (code, name, created_by, updated_by)
     VALUES ('TEST_CLIENT', 'TEST_CLIENT', $1, $1) RETURNING id`,
    [ADMIN_ID],
  );
  const companyId = companyResult.rows[0].id;

  const projectResult = await client.query(
    `INSERT INTO public.projects (
       project_code, client_company_id, name, status,
       project_manager_user_id, created_by, updated_by
     ) VALUES (NULL, $1, 'TEST_PROJECT', 'active', $2, $2, $2) RETURNING id`,
    [companyId, ADMIN_ID],
  );
  const projectId = projectResult.rows[0].id;

  await client.query(
    `INSERT INTO public.project_memberships (project_id, user_id, project_role, created_by)
     VALUES ($1, $2, 'project_manager', $2)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [projectId, ADMIN_ID],
  );

  const serviceResult = await client.query(
    `INSERT INTO public.services (code, name, created_by, updated_by)
     VALUES ('TEST_SERVICE', 'TEST_SERVICE', $1, $1) RETURNING id`,
    [ADMIN_ID],
  );
  const serviceId = serviceResult.rows[0].id;

  const deliveryResult = await client.query(
    `INSERT INTO public.service_delivery_items (
       delivery_item_code, service_id, name, sort_order, created_by, updated_by
     ) VALUES
       (NULL, $1, 'TEST_DELIVERY_ALPHA', 1, $2, $2),
       (NULL, $1, 'TEST_DELIVERY_BETA', 2, $2, $2),
       (NULL, $1, 'TEST_DELIVERY_GAMMA', 3, $2, $2)
     RETURNING id, service_id, delivery_item_code, name, sort_order`,
    [serviceId, ADMIN_ID],
  );
  const deliveryItems = deliveryResult.rows;

  const projectServiceResult = await client.query(
    `INSERT INTO public.project_services (project_id, service_id, status, created_by, updated_by)
     VALUES ($1, $2, 'active', $3, $3) RETURNING id`,
    [projectId, serviceId, ADMIN_ID],
  );
  const projectServiceId = projectServiceResult.rows[0].id;

  const projectItemsResult = await client.query(
    `SELECT count(*)::integer AS count FROM public.project_service_items
     WHERE project_service_id = $1`,
    [projectServiceId],
  );

  const deliveryItemIds = deliveryItems.map((d) => d.id);
  const deliveryItemCodes = deliveryItems.map((d) => d.delivery_item_code);

  const seed = {
    projectId,
    serviceId,
    projectServiceId,
    deliveryItemIds,
    deliveryItemCodes,
    projectItemCount: projectItemsResult.rows[0].count,
  };

  assert(seed.projectId, "Disposable seed did not return identifiers");
  assert.equal(Number(seed.projectItemCount), 3);
  return seed;
}

async function runTemplateAndRuntimeSmoke(client, seed) {
  await client.query("SET ROLE service_role");
  try {
    const templateResult = await client.query(
      `SELECT * FROM public.workflow_create_template($1, $2, $3, $4)`,
      [seed.serviceId, "TEST_WORKFLOW", "Disposable migration smoke", ADMIN_ID],
    );
    const template = templateResult.rows[0];
    assert.match(template.workflow_code, /^QTDV_[0-9]+$/u);
    assert(template.version >= 1, "Template version must be >= 1");
    assert.equal(template.status, "draft");

    const stages = await client.query(
      `INSERT INTO public.workflow_template_stages (
         workflow_template_id, name, description, sort_order,
         is_required, sla_hours
       ) VALUES
         ($1, 'TEST_STAGE_ALPHA', 'First stage', 1, true, 8),
         ($1, 'TEST_STAGE_BETA', 'Second stage', 2, true, 8)
       RETURNING id, stage_code, sort_order`,
      [template.id],
    );
    const stageAlpha = stages.rows.find((s) => s.sort_order === 1);
    const stageBeta = stages.rows.find((s) => s.sort_order === 2);
    assert(stageAlpha && stageBeta, "Both stages must be present");

    const deliveryItems = await client.query(
      `SELECT id, delivery_item_code, sort_order
       FROM public.service_delivery_items
       WHERE id = ANY($1::uuid[])
       ORDER BY sort_order`,
      [seed.deliveryItemIds],
    );
    assert.equal(deliveryItems.rowCount, 3);

    const mappedItems = await client.query(
      `INSERT INTO public.workflow_template_stage_items (
         workflow_template_stage_id, workflow_template_id,
         service_delivery_item_id, service_delivery_item_code, sort_order,
         approval_required, approval_scope, sla_hours,
         auto_create_task, completion_mode
       ) VALUES
         ($1, $3, $4, $5, 1, true, 'internal', 4, true,
          'tasks_done_and_approval'),
         ($2, $3, $6, $7, 2, false, NULL, 4, false, 'manual')
       RETURNING id, workflow_template_stage_id, sort_order`,
      [
        stageAlpha.id,
        stageBeta.id,
        template.id,
        deliveryItems.rows[0].id,
        deliveryItems.rows[0].delivery_item_code,
        deliveryItems.rows[1].id,
        deliveryItems.rows[1].delivery_item_code,
      ],
    );
    assert.equal(mappedItems.rowCount, 2);

    const itemAlpha = mappedItems.rows.find((i) => i.sort_order === 1);
    const itemBeta = mappedItems.rows.find((i) => i.sort_order === 2);
    assert(itemAlpha && itemBeta, "Both mapped items must be present");

    // Template dependency smoke
    const stageDepResult = await client.query(
      `SELECT * FROM public.workflow_add_stage_dependency($1, $2, $3, $4, $5)`,
      [template.id, stageAlpha.id, stageBeta.id, 4, ADMIN_ID],
    );
    assert.equal(stageDepResult.rowCount, 1);

    const itemDepResult = await client.query(
      `SELECT * FROM public.workflow_add_item_dependency($1, $2, $3, $4, $5)`,
      [
        template.id,
        itemAlpha.id,
        itemBeta.id,
        2,
        ADMIN_ID,
      ],
    );
    assert.equal(itemDepResult.rowCount, 1);

    // Template stage reorder smoke
    const reorderedStages = await client.query(
      `SELECT * FROM public.workflow_reorder_template_stages($1, $2, $3)`,
      [template.id, [stageBeta.id, stageAlpha.id], ADMIN_ID],
    );
    assert.equal(reorderedStages.rowCount, 2);

    await client.query(
      `SELECT * FROM public.workflow_reorder_template_stages($1, $2, $3)`,
      [template.id, [stageAlpha.id, stageBeta.id], ADMIN_ID],
    );

    // Publish template
    await client.query(
      `UPDATE public.workflow_templates
       SET status = 'published', published_by = $2, published_at = now()
       WHERE id = $1`,
      [template.id, ADMIN_ID],
    );

    // Template set default smoke
    await client.query(`SELECT public.workflow_set_default_template($1, $2)`, [
      template.id,
      ADMIN_ID,
    ]);

    // Published template immutability guard check
    await expectDatabaseError(
      () =>
        client.query(
          `INSERT INTO public.workflow_template_stages (
             workflow_template_id, name, sort_order, sla_hours
           ) VALUES ($1, 'FORBIDDEN', 3, 4)`,
          [template.id],
        ),
      ["WORKFLOW_TEMPLATE_IMMUTABLE", "P0001"],
      "Mutating published template stage graph",
    );

    // Clone template smoke
    const cloneResult = await client.query(
      `SELECT public.workflow_clone_template($1, $2) AS id`,
      [template.id, ADMIN_ID],
    );
    const clonedId = cloneResult.rows[0].id;
    const clonedRow = await client.query(
      `SELECT * FROM public.workflow_templates WHERE id = $1`,
      [clonedId],
    );
    const cloned = clonedRow.rows[0];
    assert.equal(cloned.version, template.version + 1);
    assert.equal(cloned.status, "draft");

    // Runtime Snapshot Smoke: Instantiate project service
    const instantiateResult = await client.query(
      `SELECT public.workflow_instantiate_project_service($1, $2, $3) AS result`,
      [seed.projectId, seed.projectServiceId, ADMIN_ID],
    );
    const runtimeWorkflowId = instantiateResult.rows[0].result.workflowId;
    assert(runtimeWorkflowId, "workflow_instantiate_project_service must return workflowId");
    const runtimeWorkflowRow = await client.query(
      `SELECT * FROM public.project_workflows WHERE id = $1`,
      [runtimeWorkflowId],
    );
    const runtimeWorkflow = runtimeWorkflowRow.rows[0];
    assert.match(runtimeWorkflow.project_workflow_code, /^QTDA_[0-9]+$/u);
    assert.equal(runtimeWorkflow.status, "not_started");

    const runtimeStages = await client.query(
      `SELECT id, project_workflow_stage_code, status, sort_order
       FROM public.project_workflow_stages
       WHERE project_workflow_id = $1
       ORDER BY sort_order`,
      [runtimeWorkflow.id],
    );
    assert.equal(runtimeStages.rowCount, 2);
    assert.match(
      runtimeStages.rows[0].project_workflow_stage_code,
      /^GDDA_[0-9]+$/u,
    );

    const runtimeItems = await client.query(
      `SELECT i.id, i.project_service_item_id, i.project_workflow_stage_id, i.status, i.approval_required, i.completion_mode
       FROM public.project_workflow_stage_items i
       WHERE i.project_workflow_id = $1
       ORDER BY i.created_at, i.id`,
      [runtimeWorkflow.id],
    );
    assert.equal(runtimeItems.rowCount, 2);

    const readyItem = runtimeItems.rows.find((i) => i.status === 'ready') ?? runtimeItems.rows[0];

    // Task Idempotency: Create Primary Task
    const taskResult = await client.query(
      `SELECT public.workflow_create_primary_task($1, $2, $3, $4, $5) AS result`,
      [
        seed.projectId,
        readyItem.id,
        readyItem.project_service_item_id,
        "Smoke Primary Task",
        ADMIN_ID,
      ],
    );
    const primaryTaskId = taskResult.rows[0].result.id;
    assert(primaryTaskId);

    const taskLinks = await client.query(
      `SELECT id, link_type FROM public.project_workflow_task_links
       WHERE project_workflow_stage_item_id = $1`,
      [readyItem.id],
    );
    assert.equal(taskLinks.rowCount, 1);
    assert.equal(taskLinks.rows[0].link_type, "primary");

    // Reject duplicate primary task link
    await expectDatabaseError(
      () =>
        client.query(
          `INSERT INTO public.project_workflow_task_links (
             project_workflow_stage_item_id, task_id, link_type
           ) VALUES ($1, $2, 'primary')`,
          [readyItem.id, primaryTaskId],
        ),
      ["23505", "uidx_project_workflow_task_links_primary", "duplicate key"],
      "Inserting duplicate primary task link",
    );

    // Approval Smoke: Request approval & Respond approval
    const approvalReqResult = await client.query(
      `SELECT * FROM public.workflow_request_approval($1, $2, $3, NULL, 'internal', 'Smoke note', $4)`,
      [seed.projectId, runtimeWorkflow.id, readyItem.id, ADMIN_ID],
    );
    const approvalReq = approvalReqResult.rows[0];
    assert.equal(approvalReq.status, "pending");
    assert.equal(approvalReq.approval_type, "internal");

    const approvalRespResult = await client.query(
      `SELECT * FROM public.workflow_respond_approval($1, $2, $3, 'approved', 'Smoke decision note', $4)`,
      [seed.projectId, runtimeWorkflow.id, approvalReq.id, ADMIN_ID],
    );
    const approvalResp = approvalRespResult.rows[0];
    assert.equal(approvalResp.status, "approved");

    return {
      template,
      cloned,
      stages: stages.rows,
      mappedItems: mappedItems.rows,
      deliveryItems: deliveryItems.rows,
      runtimeWorkflow,
      runtimeStages: runtimeStages.rows,
      runtimeItems: runtimeItems.rows,
      primaryTask: { id: primaryTaskId },
      approvalReq,
      approvalResp,
    };
  } finally {
    await client.query("RESET ROLE");
  }
}

async function main() {
  phase("Build explicit migration manifest and prove Phase10 isolation");
  const manifest = await loadManifest();
  process.stdout.write(`${manifest.join("\n")}\n`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const database = await client.query(
      "SELECT current_database() AS name, version() AS version",
    );
    process.stdout.write(
      `Disposable database: ${database.rows[0].name}\n${database.rows[0].version}\n`,
    );

    phase("Bootstrap only the Supabase-owned schemas required by migrations");
    await bootstrapSupabaseSurface(client);

    phase("Apply the fresh migration chain");
    await applyMigrations(client, manifest);

    phase(
      "Verify Workflow schema, functions, triggers, indexes, checks and RLS",
    );
    await assertSchema(client);
    await assertRoleIsolation(client);

    phase("Create generic disposable smoke data");
    const seed = await seedDisposableData(client);
    process.stdout.write(
      `Seeded disposable test project ${seed.projectId} and service ${seed.serviceId}.\n`,
    );

    phase("Run actual Template and runtime database smoke setup");
    const smoke = await runTemplateAndRuntimeSmoke(client, seed);
    process.stdout.write(
      `Template/RPC Smoke: Created ${smoke.template.workflow_code}, Stages: ${smoke.stages.length}, Mapped Items: ${smoke.mappedItems.length}, Cloned: ${smoke.cloned.workflow_code} (v${smoke.cloned.version})\n` +
        `Runtime Snapshot Smoke: Created ${smoke.runtimeWorkflow.project_workflow_code} with ${smoke.runtimeStages.length} stages and ${smoke.runtimeItems.length} items\n` +
        `Task Idempotency Smoke: Primary task ${smoke.primaryTask.id} linked, duplicate link rejected\n` +
        `Approval Smoke: Request ${smoke.approvalReq.id} (${smoke.approvalReq.status}) -> Decision (${smoke.approvalResp.status})\n`,
    );

    phase("Workflow migration preflight passed");
    process.stdout.write(
      "PASS: clean chain, Phase10 isolation, schema security and generic smoke data.\n",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(
    `\nWORKFLOW MIGRATION PREFLIGHT FAILED\n${error.stack ?? error}\n`,
  );
  process.exitCode = 1;
});
