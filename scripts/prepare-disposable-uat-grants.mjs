// Grant the backend service_role access only in a confirmed disposable local
// Supabase instance. This mirrors the grants installed by release verification
// and does not change application migration or production permissions.
import assert from "node:assert/strict";
import pg from "pg";
import {
  assertConfirmedLocalSupabaseMigrationDatabaseUrl,
  assertNoHostedSupabaseEnvironment,
} from "./lib/local-endpoint-guard.mjs";

assertNoHostedSupabaseEnvironment(process.env);
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
assertConfirmedLocalSupabaseMigrationDatabaseUrl(databaseUrl);

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const role = await client.query("SELECT current_user AS name");
  assert.equal(role.rows[0]?.name, "supabase_admin");

  await client.query("BEGIN");
  try {
    await client.query(`
      GRANT USAGE ON SCHEMA public TO service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
        GRANT ALL ON TABLES TO service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
        GRANT ALL ON SEQUENCES TO service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
        GRANT ALL ON FUNCTIONS TO service_role;
    `);
    const checks = await client.query(`
      SELECT
        has_table_privilege('service_role', 'public.departments', 'SELECT') AS departments,
        has_table_privilege('service_role', 'public.profiles', 'SELECT') AS profiles,
        has_table_privilege('service_role', 'public.projects', 'SELECT') AS projects,
        has_table_privilege('service_role', 'public.system_settings', 'SELECT') AS settings
    `);
    assert.deepEqual(checks.rows[0], {
      departments: true,
      profiles: true,
      projects: true,
      settings: true,
    });
    await client.query("COMMIT");
    console.log("Verified local service_role grants for core business tables.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
} finally {
  await client.end();
}
