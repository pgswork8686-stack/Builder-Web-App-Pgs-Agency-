import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import {
  assertConfirmedLocalSupabaseMigrationDatabaseUrl,
  assertNoHostedSupabaseEnvironment,
  DISPOSABLE_DATABASE_CONFIRMATION_ENV,
  DISPOSABLE_DATABASE_CONFIRMATION_VALUE,
  LOCAL_SUPABASE_MIGRATION_ROLE,
} from "./lib/local-endpoint-guard.mjs";

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

const SECURITY_HARDENING_MIGRATIONS = [
  "20260821050134_harden_security_definer_functions.sql",
];

const PAYROLL_COMPENSATION_MIGRATIONS = [
  "20260821071141_employee_compensation_settings.sql",
];

const PROFILE_LOOKUP_GRANT_MIGRATIONS = [
  "20260821081657_grant_authenticated_profile_lookup.sql",
];

const STORAGE_BUCKET_MIGRATIONS = [
  "20260821082144_create_company_documents_storage_bucket.sql",
];

const PAYROLL_HARDENING_MIGRATIONS = [
  "20260821082316_harden_payroll_run_integrity.sql",
];

const BUSINESS_RULES_MIGRATIONS = [
  "20260821100000_pgs_work_calendar_saturday_schedule.sql",
  "20260821101000_employee_compensation_history.sql",
  "20260821102000_payroll_attendance_and_compliance.sql",
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
  "employee_compensation_settings",
  "employee_compensation_history",
  "employee_monthly_payroll_reviews",
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
const RELEASE_FIXTURE_AUTH_EMAILS = [
  "admin@example.com",
  "employee.test@example.com",
  "client.test@example.com",
];
const RELEASE_FIXTURE_AUTH_IDS = [ADMIN_ID];

assertNoHostedSupabaseEnvironment(process.env);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is required. This destructive verifier only accepts the local Supabase PostgreSQL tuple (loopback host, port 54322, database postgres) with ${DISPOSABLE_DATABASE_CONFIRMATION_ENV}=${DISPOSABLE_DATABASE_CONFIRMATION_VALUE}.`,
  );
}

assertConfirmedLocalSupabaseMigrationDatabaseUrl(DATABASE_URL);

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
    ...SECURITY_HARDENING_MIGRATIONS,
    ...PAYROLL_COMPENSATION_MIGRATIONS,
    ...PROFILE_LOOKUP_GRANT_MIGRATIONS,
    ...STORAGE_BUCKET_MIGRATIONS,
    ...PAYROLL_HARDENING_MIGRATIONS,
    ...BUSINESS_RULES_MIGRATIONS,
  ];

  assert(
    !manifest.includes(LEGACY_PHASE10),
    "Release manifest must strictly exclude legacy monolithic Phase10",
  );
  assert.equal(
    new Set(manifest).size,
    manifest.length,
    "Release manifest must not contain duplicate migrations",
  );
  assert.equal(
    manifest.length,
    61,
    "Release manifest must contain the 61 accepted local migrations",
  );
  for (const file of manifest) {
    assert(
      allFiles.includes(file),
      `Required release migration missing: ${file}`,
    );
  }

  for (const file of manifest) {
    process.stdout.write(`${file}\n`);
  }

  // Verify Phase10 isolation
  let phase10Sql = "";
  try {
    phase10Sql = await readFile(join(MIGRATIONS_DIR, LEGACY_PHASE10), "utf8");
  } catch {
    phase10Sql = await readFile(
      join(ROOT, "supabase", `${LEGACY_PHASE10}.excluded`),
      "utf8",
    );
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

  const dbInfo = await client.query(
    `SELECT
       current_database() AS db,
       current_user AS role,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
       has_table_privilege(current_user, 'auth.users', 'TRIGGER') AS can_manage_auth_triggers,
       has_table_privilege(current_user, 'storage.buckets', 'INSERT') AS can_register_storage_buckets,
       version() AS version`,
  );
  assert.equal(
    dbInfo.rows[0].role,
    LOCAL_SUPABASE_MIGRATION_ROLE,
    "Migration verifier must use the local Supabase migration role",
  );
  assert.equal(
    dbInfo.rows[0].is_superuser,
    true,
    "Local Supabase migration role must retain superuser privileges",
  );
  assert.equal(
    dbInfo.rows[0].can_manage_auth_triggers,
    true,
    "Local Supabase migration role must manage auth.users triggers",
  );
  assert.equal(
    dbInfo.rows[0].can_register_storage_buckets,
    true,
    "Local Supabase migration role must register Storage buckets",
  );
  process.stdout.write(`Disposable database: ${dbInfo.rows[0].db}\n`);
  process.stdout.write(`Migration role: ${dbInfo.rows[0].role}\n`);
  process.stdout.write(`${dbInfo.rows[0].version}\n`);
  return client;
}

async function bootstrapSupabaseSurface(client) {
  phase("Reset clean public schema while preserving Supabase-owned schemas");
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;

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

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
  `);
  await client.query(
    "DELETE FROM auth.users WHERE id = ANY($1::uuid[]) OR email = ANY($2::text[])",
    [RELEASE_FIXTURE_AUTH_IDS, RELEASE_FIXTURE_AUTH_EMAILS],
  );
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
        'chk_workflow_template_stages_code_format',
        'chk_employee_compensation_base_salary_positive',
        'chk_employee_compensation_allowances_nonnegative'
      )
  `);
  assert(
    constraints.rowCount >= 5,
    "Business code regex constraints must be present",
  );

  const compensationConstraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.employee_compensation_settings'::regclass
      AND conname IN (
        'chk_employee_compensation_base_salary_positive',
        'chk_employee_compensation_allowances_nonnegative'
      )
    ORDER BY conname
  `);
  assert.deepEqual(
    compensationConstraints.rows.map((row) => row.conname),
    [
      "chk_employee_compensation_allowances_nonnegative",
      "chk_employee_compensation_base_salary_positive",
    ],
    "Employee compensation constraints must be present",
  );

  const compensationColumns = await client.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_compensation_settings'
      AND column_name IN ('base_salary', 'allowances')
    ORDER BY column_name
  `);
  assert.deepEqual(
    compensationColumns.rows,
    [
      {
        column_name: "allowances",
        is_nullable: "NO",
        column_default: null,
      },
      {
        column_name: "base_salary",
        is_nullable: "NO",
        column_default: null,
      },
    ],
    "Employee compensation salary inputs must be explicit non-null values",
  );

  const compensationForeignKey = await client.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.employee_compensation_settings'::regclass
      AND contype = 'f'
    ORDER BY conname
  `);
  assert(
    compensationForeignKey.rows.some((row) =>
      /FOREIGN KEY \(user_id\) REFERENCES (?:public\.)?employee_profiles\(user_id\) ON DELETE CASCADE/u.test(
        row.definition,
      ),
    ),
    "Employee compensation user_id must cascade from employee_profiles(user_id)",
  );

  const compensationRolePrivileges = await client.query(`
    WITH roles(role_name) AS (
      VALUES ('anon'::text), ('authenticated'::text), ('service_role'::text)
    ), privileges(privilege_type) AS (
      SELECT unnest(ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ]::text[])
    )
    SELECT roles.role_name, privileges.privilege_type
    FROM roles
    CROSS JOIN privileges
    WHERE has_table_privilege(
      roles.role_name,
      'public.employee_compensation_settings',
      privileges.privilege_type
    )
    ORDER BY roles.role_name, privileges.privilege_type
  `);
  const browserCompensationPrivileges = compensationRolePrivileges.rows.filter(
    (row) => row.role_name !== "service_role",
  );
  assert.equal(
    browserCompensationPrivileges.length,
    0,
    "PUBLIC, anon, and authenticated must have no employee compensation table privileges",
  );
  assert.equal(
    compensationRolePrivileges.rows.filter(
      (row) => row.role_name === "service_role",
    ).length,
    7,
    "service_role must retain all employee compensation table privileges",
  );

  const profileLookupPrivileges = await client.query(`
    SELECT
      has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS authenticated_can_select_profiles,
      has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_can_select_profiles,
      has_table_privilege('authenticated', 'public.profiles', 'INSERT') AS authenticated_can_insert_profiles,
      has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS authenticated_can_update_profiles,
      has_table_privilege('authenticated', 'public.profiles', 'DELETE') AS authenticated_can_delete_profiles
  `);
  assert.equal(
    profileLookupPrivileges.rows[0].authenticated_can_select_profiles,
    true,
    "authenticated must be able to SELECT public.profiles so AuthGuard can evaluate the own-row RLS policy",
  );
  assert.deepEqual(
    {
      anonCanSelectProfiles:
        profileLookupPrivileges.rows[0].anon_can_select_profiles,
      authenticatedCanInsertProfiles:
        profileLookupPrivileges.rows[0].authenticated_can_insert_profiles,
      authenticatedCanUpdateProfiles:
        profileLookupPrivileges.rows[0].authenticated_can_update_profiles,
      authenticatedCanDeleteProfiles:
        profileLookupPrivileges.rows[0].authenticated_can_delete_profiles,
    },
    {
      anonCanSelectProfiles: false,
      authenticatedCanInsertProfiles: false,
      authenticatedCanUpdateProfiles: false,
      authenticatedCanDeleteProfiles: false,
    },
    "Profile browser grant must stay read-only for authenticated users and closed to anon",
  );

  const documentBucket = await client.query(`
    SELECT id, name, public, file_size_limit
    FROM storage.buckets
    WHERE id = 'company-documents'
  `);
  assert.deepEqual(
    documentBucket.rows,
    [
      {
        id: "company-documents",
        name: "company-documents",
        public: false,
        file_size_limit: "52428800",
      },
    ],
    "Company Documents Storage bucket must exist as a private local/production bucket",
  );

  const payrollPeriodConstraint = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.payroll_runs'::regclass
      AND conname = 'uq_payroll_runs_period_month'
  `);
  assert.equal(
    payrollPeriodConstraint.rowCount,
    1,
    "Payroll runs must enforce unique period_month at database level",
  );

  const payrollRpcs = await client.query(`
    SELECT proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN ('approve_payroll_run', 'mark_payroll_run_paid')
    ORDER BY proname
  `);
  assert.deepEqual(
    payrollRpcs.rows.map((row) => row.proname),
    ["approve_payroll_run", "mark_payroll_run_paid"],
    "Payroll transactional state functions must be defined in schema public",
  );

  const exposedSecurityDefiners = await client.query(`
    SELECT
      p.oid::regprocedure::text AS identity,
      role.rolname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN pg_roles role
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND role.rolname IN ('anon', 'authenticated')
      AND has_function_privilege(role.rolname, p.oid, 'EXECUTE')
    ORDER BY identity, role.rolname
  `);
  assert.equal(
    exposedSecurityDefiners.rowCount,
    0,
    "Browser roles must not execute public SECURITY DEFINER functions",
  );

  const workCalendarSaturdayMode = await client.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_work_calendar_settings'
      AND column_name = 'saturday_schedule_mode'
  `);
  assert.equal(
    workCalendarSaturdayMode.rowCount,
    1,
    "company_work_calendar_settings must have saturday_schedule_mode column",
  );

  const payslipAuditColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payslips'
      AND column_name IN (
        'attendance_penalty_amount',
        'attendance_bonus_amount',
        'late_occurrences',
        'late_minutes',
        'absence_days',
        'early_leave_occurrences',
        'early_leave_minutes',
        'attendance_bonus_eligible'
      )
    ORDER BY column_name
  `);
  assert.equal(
    payslipAuditColumns.rowCount,
    8,
    "Payslips must contain all 8 attendance penalty, bonus and audit columns",
  );

  const compensationHistoryConstraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.employee_compensation_history'::regclass
      AND conname = 'uq_employee_compensation_history_user_effective'
  `);
  assert.equal(
    compensationHistoryConstraints.rowCount,
    1,
    "employee_compensation_history must enforce UNIQUE(user_id, effective_from)",
  );

  const monthlyReviewConstraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.employee_monthly_payroll_reviews'::regclass
      AND conname = 'uq_employee_monthly_payroll_reviews'
  `);
  assert.equal(
    monthlyReviewConstraints.rowCount,
    1,
    "employee_monthly_payroll_reviews must enforce UNIQUE(user_id, period_month)",
  );

  const earlyLeaveMakeupDefault = await client.query(`
    SELECT is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_monthly_payroll_reviews'
      AND column_name = 'early_leave_makeup_confirmed'
  `);
  assert.equal(
    earlyLeaveMakeupDefault.rowCount,
    1,
    "employee_monthly_payroll_reviews must expose early_leave_makeup_confirmed",
  );
  assert.equal(
    earlyLeaveMakeupDefault.rows[0].is_nullable,
    "NO",
    "early_leave_makeup_confirmed must be required",
  );
  assert.match(
    String(earlyLeaveMakeupDefault.rows[0].column_default),
    /false/i,
    "early_leave_makeup_confirmed must default to false",
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
  phase("Assert backend-only isolation against browser roles");

  for (const role of ["anon", "authenticated"]) {
    await client.query(`SET ROLE ${role}`);
    try {
      const unexpectedTablePrivileges = await client.query(
        `SELECT table_name
         FROM unnest($1::text[]) AS release_table(table_name)
         WHERE has_table_privilege(current_user, format('public.%I', table_name), 'SELECT')
            OR has_table_privilege(current_user, format('public.%I', table_name), 'INSERT')
         ORDER BY table_name`,
        [RELEASE_TABLES],
      );
      assert.equal(
        unexpectedTablePrivileges.rowCount,
        0,
        `${role} must not receive direct SELECT or INSERT on release business tables`,
      );

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
      await expectDatabaseError(
        () =>
          client.query(
            "SELECT * FROM public.employee_compensation_settings LIMIT 1",
          ),
        ["42501", "permission denied"],
        `${role} direct Compensation SELECT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            "SELECT * FROM public.employee_compensation_history LIMIT 1",
          ),
        ["42501", "permission denied"],
        `${role} direct Compensation History SELECT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            "SELECT * FROM public.employee_monthly_payroll_reviews LIMIT 1",
          ),
        ["42501", "permission denied"],
        `${role} direct Monthly Reviews SELECT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            `INSERT INTO public.system_settings (key, category, value)
             VALUES ($1, 'security', '{}'::jsonb)`,
            [`release-security-probe-${role}`],
          ),
        ["42501", "permission denied", "row-level security"],
        `${role} direct Settings INSERT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            `INSERT INTO public.employee_compensation_settings (
               user_id, base_salary, allowances
             ) VALUES (gen_random_uuid(), 1, 0)`,
          ),
        ["42501", "permission denied", "row-level security"],
        `${role} direct Compensation INSERT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            `INSERT INTO public.employee_compensation_history (
               user_id, base_salary, allowances, effective_from
             ) VALUES (gen_random_uuid(), 1, 0, '2026-08-01')`,
          ),
        ["42501", "permission denied", "row-level security"],
        `${role} direct Compensation History INSERT`,
      );
      await expectDatabaseError(
        () =>
          client.query(
            `INSERT INTO public.employee_monthly_payroll_reviews (
               user_id, period_month
             ) VALUES (gen_random_uuid(), '2026-08')`,
          ),
        ["42501", "permission denied", "row-level security"],
        `${role} direct Monthly Reviews INSERT`,
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
  assert(
    service.rowCount === 1,
    "Service catalog seed must have at least one service",
  );

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
  assert(
    Number(projectItemsResult.rows[0].count) >= 2,
    "Project service items must be automatically snapshotted",
  );

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
      [
        seed.serviceId,
        "RELEASE_WORKFLOW",
        "Disposable release smoke",
        ADMIN_ID,
      ],
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

    // 3. Payroll & Business Rules Smoke
    // 3A. Saturday Schedule Verification
    const satAug29 = await client.query(
      `SELECT * FROM public.resolve_company_workday('2026-08-29'::date)`,
    );
    assert.equal(
      satAug29.rows[0].is_working_day,
      true,
      "Saturday Aug 29 2026 (#5 Saturday) must resolve as working day",
    );

    const satSep05 = await client.query(
      `SELECT * FROM public.resolve_company_workday('2026-09-05'::date)`,
    );
    assert.equal(
      satSep05.rows[0].is_working_day,
      true,
      "Saturday Sep 05 2026 (#1 Saturday) must resolve as working day (monthly reset)",
    );

    const satSep12 = await client.query(
      `SELECT * FROM public.resolve_company_workday('2026-09-12'::date)`,
    );
    assert.equal(
      satSep12.rows[0].is_working_day,
      false,
      "Saturday Sep 12 2026 (#2 Saturday) must resolve as OFF",
    );

    // 3B. Compensation History Versioning
    const compHistory = await client.query(
      `INSERT INTO public.employee_compensation_history (
         user_id, base_salary, allowances, effective_from, payroll_eligible, created_by_user_id
       ) VALUES ($1, 25000000, 2000000, '2026-08-01', true, $2)
       RETURNING id, base_salary, allowances, effective_from`,
      [seed.employeeId, ADMIN_ID],
    );
    assert.equal(compHistory.rowCount, 1);
    assert.equal(String(compHistory.rows[0].base_salary), "25000000.00");

    await expectDatabaseError(
      () =>
        client.query(
          `INSERT INTO public.employee_compensation_history (
             user_id, base_salary, allowances, effective_from, payroll_eligible, created_by_user_id
           ) VALUES ($1, 99999999, 0, '2026-08-01', false, $2)`,
          [seed.employeeId, ADMIN_ID],
        ),
      ["23505", "uq_employee_compensation_history_user_effective"],
      "Duplicate employee compensation revision",
    );
    const unchangedCompHistory = await client.query(
      `SELECT base_salary, allowances, payroll_eligible
       FROM public.employee_compensation_history
       WHERE id = $1`,
      [compHistory.rows[0].id],
    );
    assert.equal(
      String(unchangedCompHistory.rows[0].base_salary),
      "25000000.00",
    );
    assert.equal(String(unchangedCompHistory.rows[0].allowances), "2000000.00");
    assert.equal(unchangedCompHistory.rows[0].payroll_eligible, true);

    const effectiveComp = await client.query(
      `SELECT * FROM public.get_effective_employee_compensation($1, '2026-08-15'::date)`,
      [seed.employeeId],
    );
    assert.equal(effectiveComp.rowCount, 1);
    assert.equal(String(effectiveComp.rows[0].base_salary), "25000000.00");

    // 3C. Monthly Reviews
    const monthlyReview = await client.query(
      `INSERT INTO public.employee_monthly_payroll_reviews (
         user_id, period_month, discipline_bonus_eligible
       ) VALUES ($1, '2026-08', true)
       RETURNING id, discipline_bonus_eligible, early_leave_makeup_confirmed`,
      [seed.employeeId],
    );
    assert.equal(monthlyReview.rowCount, 1);
    assert.equal(monthlyReview.rows[0].discipline_bonus_eligible, true);
    assert.equal(monthlyReview.rows[0].early_leave_makeup_confirmed, false);

    const payrollRun = await client.query(
      `INSERT INTO public.payroll_runs (
         period_month, period_start_date, period_end_date, title, total_gross_amount, total_net_amount
       ) VALUES (
         '1999-01', '1999-01-01', '1999-01-31', 'Bảng lương smoke 01/1999', 20000000, 18500000
       ) RETURNING id, run_code, status`,
    );
    assert.match(payrollRun.rows[0].run_code, /^BL_[0-9]+$/u);

    const payslip = await client.query(
      `INSERT INTO public.payslips (
         payroll_run_id, user_id, employee_profile_id, base_salary, gross_salary, net_salary,
         attendance_penalty_amount, attendance_bonus_amount, late_occurrences, late_minutes,
         absence_days, attendance_bonus_eligible
       ) VALUES ($1, $2, $2, 20000000, 20250000, 18750000, 0, 250000, 1, 3, 0, true)
       RETURNING id, payslip_code, payroll_run_code, user_code, attendance_bonus_amount, attendance_bonus_eligible`,
      [payrollRun.rows[0].id, seed.employeeId],
    );
    assert.match(payslip.rows[0].payslip_code, /^PL_[0-9]+$/u);
    assert.equal(payslip.rows[0].payroll_run_code, payrollRun.rows[0].run_code);
    assert.equal(String(payslip.rows[0].attendance_bonus_amount), "250000.00");
    assert.equal(payslip.rows[0].attendance_bonus_eligible, true);

    const compensation = await client.query(
      `INSERT INTO public.employee_compensation_settings (
         user_id, base_salary, allowances, updated_by_user_id
       ) VALUES ($1, 20000000, 500000, $2)
       ON CONFLICT (user_id) DO UPDATE SET base_salary = 20000000
       RETURNING user_id, base_salary, allowances`,
      [seed.employeeId, ADMIN_ID],
    );
    assert.equal(compensation.rowCount, 1);
    assert.equal(String(compensation.rows[0].base_salary), "20000000.00");
    assert.equal(String(compensation.rows[0].allowances), "500000.00");
    await expectDatabaseError(
      () =>
        client.query(
          "UPDATE public.employee_compensation_settings SET base_salary = 0 WHERE user_id = $1",
          [seed.employeeId],
        ),
      ["23514", "chk_employee_compensation_base_salary_positive"],
      "Non-positive employee compensation base salary",
    );
    await expectDatabaseError(
      () =>
        client.query(
          "UPDATE public.employee_compensation_settings SET allowances = -1 WHERE user_id = $1",
          [seed.employeeId],
        ),
      ["23514", "chk_employee_compensation_allowances_nonnegative"],
      "Negative employee compensation allowances",
    );

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
        `- Compensation: backend-only row created; invalid salary/allowance rejected\n` +
        `- Documents: ${document.rows[0].document_code}\n` +
        `- Support: Ticket ${ticket.rows[0].ticket_code} with response message\n` +
        `- Settings: Initial configurations active\n`,
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
    process.stderr.write(
      `\nRELEASE MIGRATION PREFLIGHT FAILED\n${error.stack ?? error.message}\n`,
    );
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
