import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const LEGACY_PHASE10 = "20260819130000_phase10_all_missing_modules.sql";
const BASELINE_END = "20260819150700";

const WORKFLOW_MIGRATIONS = [
  "20260820120000_workflow_engine_v1_foundation.sql",
  "20260820123000_workflow_engine_v1_hardening.sql",
  "20260820124000_workflow_engine_v1_runtime_hardening.sql",
  "20260820125000_workflow_engine_v1_p2_closure.sql",
];

const PHASE10_REPLACEMENT_MIGRATIONS = [
  "20260820130000_project_expenses_v1.sql",
  "20260820131000_payroll_v1.sql",
  "20260820132000_company_documents_v1.sql",
  "20260820133000_support_v1.sql",
  "20260820134000_system_settings_v1.sql",
  "20260820135000_release_db_performance_hardening.sql",
];

const RELEASE_TABLES = [
  // Workflow
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
  // Replacement Phase10 Modules
  "project_expenses",
  "payroll_runs",
  "payslips",
  "company_documents",
  "support_tickets",
  "support_ticket_messages",
  "system_settings",
];

const RELEASE_SEQUENCES = [
  "seq_workflow_template_code",
  "seq_workflow_stage_code",
  "seq_project_workflow_code",
  "seq_project_workflow_stage_code",
  "project_expenses_code_seq",
  "payroll_runs_code_seq",
  "payslips_code_seq",
  "company_documents_code_seq",
  "support_tickets_code_seq",
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

  const phase10PresentInDir = allFiles.includes(LEGACY_PHASE10);
  const baseline = allFiles.filter((file) => {
    const stamp = file.slice(0, 14);
    return stamp <= BASELINE_END && file !== LEGACY_PHASE10;
  });

  const manifest = [
    ...baseline,
    ...WORKFLOW_MIGRATIONS,
    ...PHASE10_REPLACEMENT_MIGRATIONS,
  ];

  assert(
    !manifest.includes(LEGACY_PHASE10),
    "Release manifest must strictly exclude legacy monolithic Phase10",
  );

  for (const file of manifest) {
    process.stdout.write(`${file}\n`);
  }

  // Verify Phase10 isolation
  let phase10Sql = "";
  try {
    phase10Sql = await readFile(join(MIGRATIONS_DIR, LEGACY_PHASE10), "utf8");
  } catch {
    phase10Sql = await readFile(join(ROOT, "supabase", `${LEGACY_PHASE10}.excluded`), "utf8");
  }
  const phase10Created = extractCreatedPublicObjects(phase10Sql);

  for (const file of [...baseline, ...WORKFLOW_MIGRATIONS]) {
    const content = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    for (const objectName of phase10Created) {
      const matcher = new RegExp(`\\bpublic\\.${objectName}\\b`, "iu");
      if (
        matcher.test(content) &&
        !/COMMENT\s+ON/iu.test(content) &&
        !/DROP\s+(?:TABLE|FUNCTION|VIEW)/iu.test(content)
      ) {
        throw new Error(
          `Pre-release migration ${file} unexpectedly references Phase10 object public.${objectName}`,
        );
      }
    }
  }

  return manifest;
}

async function createClient() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const isProduction =
    /umtgfaqjoqbsdzwpqizq/u.test(DATABASE_URL) ||
    /supabase\.co/u.test(DATABASE_URL);
  if (isProduction) {
    throw new Error(
      "Refusing to execute migration verification against Production database!",
    );
  }

  const dbInfo = await client.query(
    "SELECT current_database() AS db, version() AS version",
  );
  process.stdout.write(`Disposable database: ${dbInfo.rows[0].db}\n`);
  process.stdout.write(`${dbInfo.rows[0].version}\n`);
  return client;
}

async function bootstrapSupabaseSurface(client) {
  phase("Bootstrap clean Supabase environment");
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS supabase_migrations CASCADE;

    CREATE SCHEMA public;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;

    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;

    GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON SCHEMA extensions TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claim.sub', true),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
      )::uuid;
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true))
      );
    $$;

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

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      owner UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      public BOOLEAN DEFAULT false,
      avif_autodetection BOOLEAN DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT REFERENCES storage.buckets(id),
      name TEXT,
      owner UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      last_accessed_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB,
      path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
    );

    ALTER TABLE storage.objects DISABLE TRIGGER ALL;
    ALTER TABLE storage.buckets DISABLE TRIGGER ALL;
    DELETE FROM storage.objects;
    DELETE FROM storage.buckets;
    ALTER TABLE storage.objects ENABLE TRIGGER ALL;
    ALTER TABLE storage.buckets ENABLE TRIGGER ALL;
    DELETE FROM auth.users;
  `);
}

async function applyMigrations(client, manifest) {
  phase("Apply the release migration chain");
  let applied = 0;
  for (const file of manifest) {
    const fullPath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(fullPath, "utf8");
    process.stdout.write(`Applying ${file}\n`);
    try {
      await client.query(
        `SET search_path = public, auth, storage, extensions; ${sql}; SET search_path = public, extensions;`,
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
    `Applied ${applied} release migrations cleanly from empty database.\n`,
  );
}

async function assertReleaseSchema(client) {
  phase("Assert release schemas, tables, RLS, sequences and triggers");

  const tables = await client.query(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
     ORDER BY c.relname`,
    [RELEASE_TABLES],
  );
  assert.equal(tables.rowCount, RELEASE_TABLES.length);
  assert(
    tables.rows.every((row) => row.relrowsecurity),
    "Every business table in release must have RLS enabled",
  );

  const sequences = await client.query(
    `SELECT c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
       AND c.relname = ANY($1::text[])`,
    [RELEASE_SEQUENCES],
  );
  assert.equal(sequences.rowCount, RELEASE_SEQUENCES.length);

  // Check format constraints
  const constraints = await client.query(`
    SELECT conname, relname
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND conname IN (
        'chk_project_expenses_code_format',
        'chk_payroll_runs_code_format',
        'chk_payslips_code_format',
        'chk_company_documents_code_format',
        'chk_support_tickets_code_format',
        'chk_workflow_templates_code_format',
        'chk_workflow_template_stages_code_format'
      )
  `);
  assert(constraints.rowCount >= 5, "Business code regex constraints must be present");
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
  phase("Assert backend-only isolation against browser roles");

  for (const role of ["anon", "authenticated"]) {
    await client.query(`SET ROLE ${role}`);
    try {
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.workflow_templates LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Workflow SELECT`,
      );
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.project_expenses LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Expenses SELECT`,
      );
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.payroll_runs LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Payroll SELECT`,
      );
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.company_documents LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Documents SELECT`,
      );
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.support_tickets LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Support SELECT`,
      );
      await expectDatabaseError(
        () => client.query("SELECT * FROM public.system_settings LIMIT 1"),
        ["42501", "permission denied"],
        `${role} direct Settings SELECT`,
      );
    } finally {
      await client.query("RESET ROLE");
    }
  }
}

async function seedDisposableData(client) {
  phase("Create generic disposable test baseline");

  await client.query(
    `INSERT INTO auth.users (id, email)
     VALUES ($1, 'admin@example.com')
     ON CONFLICT (id) DO NOTHING`,
    [ADMIN_ID],
  );

  await client.query(
    `UPDATE public.profiles
     SET full_name = 'System Administrator', role = 'admin', account_status = 'active', approved_by = $1, approved_at = now()
     WHERE id = $1`,
    [ADMIN_ID],
  );

  const employeeUser = await client.query(
    `INSERT INTO auth.users (id, email)
     VALUES (gen_random_uuid(), 'employee.test@example.com')
     RETURNING id`,
  );
  const employeeId = employeeUser.rows[0].id;
  await client.query(
    `UPDATE public.profiles
     SET full_name = 'Test Employee', role = 'employee', account_status = 'active', approved_by = $2, approved_at = now()
     WHERE id = $1`,
    [employeeId, ADMIN_ID],
  );
  await client.query(
    `INSERT INTO public.employee_profiles (user_id, job_title)
     VALUES ($1, 'Software Engineer')`,
    [employeeId],
  );

  const clientCompany = await client.query(`
    INSERT INTO public.client_companies (code, name, tax_code)
    VALUES ('DISPOSABLE_CLIENT', 'Disposable Client Corp', '0109999999')
    RETURNING id, client_code
  `);

  const clientUser = await client.query(
    `INSERT INTO auth.users (id, email)
     VALUES (gen_random_uuid(), 'client.test@example.com')
     RETURNING id`,
  );
  const clientUserId = clientUser.rows[0].id;
  await client.query(
    `UPDATE public.profiles
     SET full_name = 'Test Client Contact', role = 'client', account_status = 'active', approved_by = $2, approved_at = now()
     WHERE id = $1`,
    [clientUserId, ADMIN_ID],
  );
  await client.query(
    `INSERT INTO public.client_memberships (user_id, client_company_id)
     VALUES ($1, $2)`,
    [clientUserId, clientCompany.rows[0].id],
  );

  const project = await client.query(
    `INSERT INTO public.projects (
       name, client_company_id, description, status
     ) VALUES (
       'Disposable Release Project', $1, 'Automated smoke project', 'active'
     ) RETURNING id, project_code`,
    [clientCompany.rows[0].id],
  );

  const service = await client.query(`
    SELECT id, service_code FROM public.services LIMIT 1
  `);
  assert(service.rowCount === 1, "Service catalog seed must have at least one service");

  const projectService = await client.query(
    `INSERT INTO public.project_services (
       project_id, service_id, status
     ) VALUES ($1, $2, 'active')
     RETURNING id, project_service_code`,
    [project.rows[0].id, service.rows[0].id],
  );

  const deliveryItems = await client.query(
    `SELECT id, delivery_item_code, name, sort_order
     FROM public.service_delivery_items
     WHERE service_id = $1
     ORDER BY sort_order
     LIMIT 3`,
    [service.rows[0].id],
  );
  assert(deliveryItems.rowCount >= 2, "Need at least 2 delivery items");

  const projectItemsResult = await client.query(
    `SELECT count(*) FROM public.project_service_items WHERE project_service_id = $1`,
    [projectService.rows[0].id],
  );
  assert(Number(projectItemsResult.rows[0].count) >= 2, "Project service items must be automatically snapshotted");

  return {
    projectId: project.rows[0].id,
    projectCode: project.rows[0].project_code,
    serviceId: service.rows[0].id,
    projectServiceId: projectService.rows[0].id,
    clientCompanyId: clientCompany.rows[0].id,
    employeeId,
    clientUserId,
    deliveryItemIds: deliveryItems.rows.map((d) => d.id),
  };
}

async function runReleaseSmoke(client, seed) {
  phase("Run full smoke tests across Workflow and Phase10 replacement modules");
  await client.query("SET ROLE service_role");
  try {
    // 1. Workflow Smoke
    const templateResult = await client.query(
      `SELECT * FROM public.workflow_create_template($1, $2, $3, $4)`,
      [seed.serviceId, "RELEASE_WORKFLOW", "Disposable release smoke", ADMIN_ID],
    );
    const template = templateResult.rows[0];
    assert.match(template.workflow_code, /^QTDV_[0-9]+$/u);

    const stages = await client.query(
      `INSERT INTO public.workflow_template_stages (
         workflow_template_id, name, description, sort_order,
         is_required, sla_hours
       ) VALUES
         ($1, 'RELEASE_STAGE_A', 'Stage 1', 1, true, 8),
         ($1, 'RELEASE_STAGE_B', 'Stage 2', 2, true, 8)
       RETURNING id, stage_code, sort_order`,
      [template.id],
    );

    const mappedItems = await client.query(
      `INSERT INTO public.workflow_template_stage_items (
         workflow_template_stage_id, workflow_template_id,
         service_delivery_item_id, sort_order, approval_required,
         completion_mode, auto_create_task
       ) VALUES
         ($1, $3, $4, 1, true, 'tasks_done_and_approval', true),
         ($2, $3, $5, 2, false, 'manual', false)
       RETURNING id`,
      [
        stages.rows[0].id,
        stages.rows[1].id,
        template.id,
        seed.deliveryItemIds[0],
        seed.deliveryItemIds[1],
      ],
    );

    await client.query(
      `SELECT * FROM public.workflow_add_stage_dependency($1, $2, $3, 4, $4)`,
      [template.id, stages.rows[0].id, stages.rows[1].id, ADMIN_ID],
    );

    await client.query(
      `UPDATE public.workflow_templates
       SET status = 'published', published_by = $2, published_at = now()
       WHERE id = $1`,
      [template.id, ADMIN_ID],
    );

    await client.query(`SELECT public.workflow_set_default_template($1, $2)`, [
      template.id,
      ADMIN_ID,
    ]);

    const instantiateResult = await client.query(
      `SELECT public.workflow_instantiate_project_service($1, $2, $3) AS result`,
      [seed.projectId, seed.projectServiceId, ADMIN_ID],
    );
    const runtimeWorkflowId = instantiateResult.rows[0].result.workflowId;
    assert(runtimeWorkflowId);

    // 2. Project Expenses Smoke
    const expense = await client.query(
      `INSERT INTO public.project_expenses (
         project_id, submitted_by_user_id, title, amount, expense_category
       ) VALUES ($1, $2, 'Test Software License', 500000, 'software_license')
       RETURNING id, expense_code, project_code, submitted_by_user_code, status`,
      [seed.projectId, seed.employeeId],
    );
    assert.match(expense.rows[0].expense_code, /^CP_[0-9]+$/u);
    assert.equal(expense.rows[0].status, "pending");
    assert(expense.rows[0].project_code, "project_code companion must sync");

    await client.query(
      `UPDATE public.project_expenses
       SET status = 'approved', approved_by_user_id = $2, approved_at = now()
       WHERE id = $1`,
      [expense.rows[0].id, ADMIN_ID],
    );

    // 3. Payroll Smoke
    const payrollRun = await client.query(
      `INSERT INTO public.payroll_runs (
         period_month, period_start_date, period_end_date, title, total_gross_amount, total_net_amount
       ) VALUES (
         '2026-08', '2026-08-01', '2026-08-31', 'Bảng lương tháng 08/2026', 20000000, 18500000
       ) RETURNING id, run_code, status`,
    );
    assert.match(payrollRun.rows[0].run_code, /^BL_[0-9]+$/u);

    const payslip = await client.query(
      `INSERT INTO public.payslips (
         payroll_run_id, user_id, employee_profile_id, base_salary, gross_salary, net_salary
       ) VALUES ($1, $2, $2, 20000000, 20000000, 18500000)
       RETURNING id, payslip_code, payroll_run_code, user_code`,
      [payrollRun.rows[0].id, seed.employeeId],
    );
    assert.match(payslip.rows[0].payslip_code, /^PL_[0-9]+$/u);
    assert.equal(payslip.rows[0].payroll_run_code, payrollRun.rows[0].run_code);

    // 4. Company Documents Smoke
    const document = await client.query(
      `INSERT INTO public.company_documents (
         title, category, storage_path, file_name, mime_type, size_bytes,
         uploaded_by_user_id
       ) VALUES (
         'Internal Security Handbook', 'policy_procedure', 'docs/sec_handbook.pdf',
         'sec_handbook.pdf', 'application/pdf', 102400, $1
       ) RETURNING id, document_code, uploaded_by_user_code`,
      [ADMIN_ID],
    );
    assert.match(document.rows[0].document_code, /^TL_[0-9]+$/u);

    // 5. Customer Support Smoke
    const ticket = await client.query(
      `INSERT INTO public.support_tickets (
         client_company_id, project_id, creator_user_id, title, description, category
       ) VALUES ($1, $2, $3, 'Need assistance with delivery item', 'Smoke inquiry', 'technical')
       RETURNING id, ticket_code, client_company_code, project_code`,
      [seed.clientCompanyId, seed.projectId, seed.clientUserId],
    );
    assert.match(ticket.rows[0].ticket_code, /^YC_[0-9]+$/u);
    assert(ticket.rows[0].client_company_code);

    const ticketMsg = await client.query(
      `INSERT INTO public.support_ticket_messages (
         ticket_id, sender_user_id, content
       ) VALUES ($1, $2, 'We are looking into this immediately.')
       RETURNING id, ticket_code, sender_user_code`,
      [ticket.rows[0].id, ADMIN_ID],
    );
    assert.equal(ticketMsg.rows[0].ticket_code, ticket.rows[0].ticket_code);

    // 6. System Settings Smoke
    const setting = await client.query(
      `SELECT key, category, value FROM public.system_settings WHERE key = 'company_info'`,
    );
    assert.equal(setting.rowCount, 1);

    process.stdout.write(
      `Smoke Results:\n` +
      `- Workflow: Template ${template.workflow_code} -> Runtime QTDA\n` +
      `- Expenses: ${expense.rows[0].expense_code} approved\n` +
      `- Payroll: Run ${payrollRun.rows[0].run_code} -> Payslip ${payslip.rows[0].payslip_code}\n` +
      `- Documents: ${document.rows[0].document_code}\n` +
      `- Support: Ticket ${ticket.rows[0].ticket_code} with response message\n` +
      `- Settings: Initial configurations active\n`
    );
  } finally {
    await client.query("RESET ROLE");
  }
}

async function main() {
  let client;
  try {
    phase("Build explicit release manifest and verify Phase10 exclusion");
    const manifest = await loadManifest();

    client = await createClient();
    await bootstrapSupabaseSurface(client);
    await applyMigrations(client, manifest);
    await assertReleaseSchema(client);
    await assertRoleIsolation(client);
    const seed = await seedDisposableData(client);
    await runReleaseSmoke(client, seed);

    phase("Full Release Migration Preflight Passed");
    process.stdout.write(
      "PASS: Clean chain, legacy Phase10 excluded, all modular replacement schemas + Workflow engine verified.\n",
    );
  } catch (error) {
    process.stderr.write(`\nRELEASE MIGRATION PREFLIGHT FAILED\n${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
