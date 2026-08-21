import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertConfirmedLocalSupabaseMigrationDatabaseUrl,
  assertNoHostedSupabaseEnvironment,
} from "./local-endpoint-guard.mjs";

const SCRIPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("allows a local-only environment", () => {
  assert.doesNotThrow(() =>
    assertNoHostedSupabaseEnvironment({
      DATABASE_URL: "postgresql://postgres@127.0.0.1:54322/postgres",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      PGS_RELEASE_DB_DISPOSABLE: "confirmed",
    }),
  );
});

test("rejects the known hosted project reference without exposing it", () => {
  const hostedReference = "umtgfaqjoqbsdzwpqizq";

  assert.throws(
    () =>
      assertNoHostedSupabaseEnvironment({
        UNRELATED_CONFIGURATION: `prefix-${hostedReference}-suffix`,
      }),
    (error) => {
      assert.match(error.message, /hosted Supabase marker/u);
      assert.doesNotMatch(error.message, new RegExp(hostedReference, "iu"));
      return true;
    },
  );
});

test("rejects hosted Supabase URLs without exposing them", () => {
  const hostedUrl = "https://example.supabase.co";

  assert.throws(
    () =>
      assertNoHostedSupabaseEnvironment({
        EXTERNAL_SERVICE_URL: hostedUrl,
      }),
    (error) => {
      assert.match(error.message, /hosted Supabase marker/u);
      assert.doesNotMatch(error.message, new RegExp("supabase\\.co", "iu"));
      assert.doesNotMatch(
        error.message,
        new RegExp(hostedUrl.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      );
      return true;
    },
  );
});

test("accepts the exact local Supabase migration role", () => {
  assert.doesNotThrow(() =>
    assertConfirmedLocalSupabaseMigrationDatabaseUrl(
      "postgresql://supabase_admin:local-only-password@127.0.0.1:54322/postgres",
      "DATABASE_URL",
      { PGS_RELEASE_DB_DISPOSABLE: "confirmed" },
    ),
  );
});

test("rejects the non-superuser local postgres role without exposing credentials", () => {
  const password = "local-only-password";

  assert.throws(
    () =>
      assertConfirmedLocalSupabaseMigrationDatabaseUrl(
        `postgresql://postgres:${password}@127.0.0.1:54322/postgres`,
        "DATABASE_URL",
        { PGS_RELEASE_DB_DISPOSABLE: "confirmed" },
      ),
    (error) => {
      assert.match(error.message, /supabase_admin/u);
      assert.doesNotMatch(error.message, new RegExp(password, "u"));
      return true;
    },
  );
});

test("local release entrypoints preflight the complete environment before connecting", async () => {
  const entrypoints = [
    ["verify-release-migrations.mjs", "new Client"],
    ["verify-workflow-migrations.mjs", "new Client"],
    ["seed-local-uat.mjs", "new Client"],
    ["run-full-local-uat.mjs", "new Client"],
    ["capture-screenshots.mjs", "chromium.launch"],
  ];

  for (const [fileName, connectionBoundary] of entrypoints) {
    const source = await readFile(resolve(SCRIPTS_DIR, fileName), "utf8");
    const preflightIndex = source.indexOf(
      "assertNoHostedSupabaseEnvironment(process.env)",
    );
    const connectionIndex = source.indexOf(connectionBoundary);

    assert.ok(preflightIndex >= 0, `${fileName} must scan process.env`);
    assert.ok(connectionIndex >= 0, `${fileName} must retain its boundary`);
    assert.ok(
      preflightIndex < connectionIndex,
      `${fileName} must scan process.env before ${connectionBoundary}`,
    );
  }
});
