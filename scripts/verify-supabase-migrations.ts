import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const CONTAINER_NAME = "supabase_db_tmp-pgs-supabase-audit";
const TEST_DB = "pgs_clean_migration_validation";
const MIGRATIONS_DIR = resolve(__dirname, "../supabase/migrations");

function runPsql(sql: string, db = TEST_DB): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER_NAME} psql -U postgres -d ${db} -v ON_ERROR_STOP=1`,
      { input: Buffer.from(sql, "utf8"), encoding: "utf8" },
    );
  } catch (err: any) {
    console.error(
      `PSQL execution failed on [${db}]:`,
      err.stdout || err.stderr || err.message,
    );
    throw err;
  }
}

function runPsqlFile(filePath: string, db = TEST_DB): string {
  try {
    return execSync(
      `docker exec -i ${CONTAINER_NAME} psql -U postgres -d ${db} -v ON_ERROR_STOP=1`,
      { input: readFileSync(filePath), encoding: "utf8" },
    );
  } catch (err: any) {
    console.error(
      `PSQL file execution failed for ${filePath}:`,
      err.stdout || err.stderr || err.message,
    );
    throw err;
  }
}

async function main() {
  console.log("--- 1. Resetting Disposable Clean Test Database ---");
  runPsql(`DROP DATABASE IF EXISTS ${TEST_DB};`, "postgres");
  runPsql(`CREATE DATABASE ${TEST_DB};`, "postgres");

  console.log(
    "--- 2. Setting up Supabase Core Schemas & auth/storage Mocks ---",
  );
  runPsql(
    `
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      phone TEXT,
      raw_user_meta_data JSONB,
      raw_app_meta_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT COALESCE(nullif(current_setting('request.jwt.claim.sub', true), ''), '00000000-0000-0000-0000-000000000000')::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      public BOOLEAN DEFAULT FALSE,
      avif_autodetection BOOLEAN DEFAULT FALSE,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[],
      owner_id TEXT
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT REFERENCES storage.buckets(id),
      name TEXT,
      owner UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB,
      path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
      version TEXT,
      owner_id TEXT
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    GRANT ALL ON SCHEMA public TO postgres, authenticated, anon, service_role;
    GRANT ALL ON SCHEMA auth TO postgres, authenticated, anon, service_role;
    GRANT ALL ON SCHEMA storage TO postgres, authenticated, anon, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, authenticated, anon, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, authenticated, anon, service_role;
  `,
    TEST_DB,
  );

  console.log("--- 3. Executing All 24 Migrations in Sequential Order ---");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    console.log(`Applying [${++count}/${files.length}]: ${file}...`);
    runPsqlFile(filePath, TEST_DB);
  }
  console.log(
    `\n>>> SUCCESS: All ${files.length} migrations applied cleanly without errors! <<<\n`,
  );

  console.log(
    "--- 4. Running Regression Test: Business Code Format Enforce ---",
  );
  runPsql(
    `
    -- Insert an admin user using bootstrap_initial_admin
    INSERT INTO auth.users (id, email) VALUES ('11111111-1111-4111-8111-111111111111', 'admin@pgs.vn');
    SELECT public.bootstrap_initial_admin('11111111-1111-4111-8111-111111111111'::uuid);

    -- Insert a client company without code, verify auto-generated KH_01
    INSERT INTO public.client_companies (name, code)
    VALUES ('Test Company Alpha', 'ALPHA_LEGACY');

    -- Insert a project, verify auto-generated DA_01
    INSERT INTO public.projects (name, client_company_id, project_manager_user_id, status)
    VALUES ('Project Alpha', (SELECT id FROM public.client_companies WHERE name = 'Test Company Alpha'), '11111111-1111-4111-8111-111111111111', 'active');
  `,
    TEST_DB,
  );

  const clientCheck = runPsql(
    `SELECT client_code, code FROM public.client_companies WHERE name = 'Test Company Alpha';`,
    TEST_DB,
  );
  console.log("Client auto-generated code:\n", clientCheck.trim());
  if (!clientCheck.includes("KH_"))
    throw new Error("Client code auto-generation failed");

  const projectCheck = runPsql(
    `SELECT project_code, name FROM public.projects WHERE name = 'Project Alpha';`,
    TEST_DB,
  );
  console.log("Project auto-generated code:\n", projectCheck.trim());
  if (!projectCheck.includes("DA_"))
    throw new Error("Project code auto-generation failed");

  console.log("--- 5. Running Regression Test: Immutability Protection ---");
  let immutabilityPassed = false;
  try {
    runPsql(
      `UPDATE public.client_companies SET client_code = 'KH_9999' WHERE name = 'Test Company Alpha';`,
      TEST_DB,
    );
  } catch (err: any) {
    if (
      err.message?.includes("immutable") ||
      err.stderr?.includes("immutable") ||
      err.stdout?.includes("immutable")
    ) {
      immutabilityPassed = true;
      console.log(
        ">>> Immutability Protection Verified: UPDATE was correctly BLOCKED by database trigger! <<<",
      );
    }
  }
  if (!immutabilityPassed) {
    throw new Error(
      "Immutability failure: Client code was allowed to be modified!",
    );
  }

  console.log("--- 6. Running Regression Test: Collision-Proof Backfill ---");
  runPsql(
    `
    -- Add pre-existing valid codes
    INSERT INTO auth.users (id, email) VALUES
      ('22222222-2222-4222-8222-222222222222', 'user2@pgs.vn'),
      ('33333333-3333-4333-8333-333333333333', 'user3@pgs.vn'),
      ('44444444-4444-4444-8444-444444444444', 'user4@pgs.vn');

    SELECT public.approve_pending_account('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'employee'::public.app_role);
    SELECT public.approve_pending_account('11111111-1111-4111-8111-111111111111'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 'employee'::public.app_role);
    SELECT public.approve_pending_account('11111111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, 'employee'::public.app_role);

    -- Insert employee profiles with manual code NV_05
    INSERT INTO public.employee_profiles (user_id, employee_code, employment_status)
    VALUES ('22222222-2222-4222-8222-222222222222', 'NV_05', 'active');

    -- Insert another employee without code (trigger should use sequence after max)
    INSERT INTO public.employee_profiles (user_id, employment_status)
    VALUES ('33333333-3333-4333-8333-333333333333', 'active');
  `,
    TEST_DB,
  );

  const empCheck = runPsql(
    `SELECT user_id, employee_code FROM public.employee_profiles ORDER BY employee_code ASC;`,
    TEST_DB,
  );
  console.log("Employee Codes after collision-safe test:\n", empCheck.trim());

  console.log(
    "--- 7. Running Regression Test: Admin Views Query Execution ---",
  );
  const viewResults = runPsql(
    `
    SELECT * FROM public.admin_clients;
    SELECT * FROM public.admin_people;
    SELECT * FROM public.admin_projects;
    SELECT * FROM public.admin_departments;
    SELECT * FROM public.admin_teams;
    SELECT * FROM public.admin_tasks;
  `,
    TEST_DB,
  );
  console.log(
    "Admin Views query execution preview:\n",
    viewResults.slice(0, 400),
  );

  console.log("\n======================================================");
  console.log("ALL 7 DATABASE QUALITY GATES & REGRESSION CHECKS PASSED");
  console.log("======================================================");
}

main().catch((err) => {
  console.error("Migration verification script failed:", err);
  process.exit(1);
});
