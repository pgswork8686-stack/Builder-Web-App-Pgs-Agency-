# PGS HUB — Full System Test Environment

## Status

**Environment provisioning: PASS for the disposable local stack.** Docker Desktop and Local Supabase were started only on loopback. No hosted Supabase project was created or contacted.

## Source under test

| Item            | Observed value                                  |
| --------------- | ----------------------------------------------- |
| Working branch  | `feat/workflow-engine-v1`                       |
| Input SHA       | `9807a0858a79d311f219b0337ac92f77eccf2b7a`      |
| Required branch | `main`, after merge of PR #7                    |
| Source gate     | **FAIL** — the checked-out source is not `main` |

Do not treat historic UAT files as evidence for this source. The final decision is recorded in [FINAL_ACCEPTANCE_REPORT.md](FINAL_ACCEPTANCE_REPORT.md).

## Isolated local design

| Component                 | Local endpoint / port                 |
| ------------------------- | ------------------------------------- |
| Next.js web               | `http://localhost:3000`               |
| NestJS API                | `http://localhost:3001/api/v1`        |
| API health                | `http://localhost:3001/api/v1/health` |
| Supabase API/Auth/Storage | `http://127.0.0.1:54321`              |
| PostgreSQL                | `127.0.0.1:54322`                     |
| Supabase Studio           | `http://127.0.0.1:54323`              |

The repository pins the local Supabase CLI at `2.111.0`. `apps/api/.env.test` is loopback-only, and API environment validation rejects hosted `SUPABASE_URL` or `WEB_URL` whenever `APP_ENV=test`. Destructive migration verifiers accept only the known local Supabase PostgreSQL tuple (`127.0.0.1`/`localhost`/`::1`, port `54322`, database `postgres`) with the local `supabase_admin` migration role and require an explicit disposable-database acknowledgement before opening a connection. The local `postgres` login is intentionally non-superuser and cannot manage the Supabase-owned `auth` and `storage` schemas used by the migration chain.

`scripts/verify-live-supabase.mjs` and `scripts/verify-live-auth.mjs` are intentionally disabled: they must never query, authenticate to, or create users in a hosted project.

## Migration manifest

The local release verifier applies **57** active migrations:

- 43 baseline migrations through `20260819150700`;
- 4 Workflow Engine V1 migrations;
- 6 hardened modular replacement migrations (including performance hardening);
- 1 security-hardening migration: `20260821050134_harden_security_definer_functions.sql`.
- 1 backend-only payroll compensation migration:
  `20260821071141_employee_compensation_settings.sql`.
- 1 auth profile lookup grant migration:
  `20260821081657_grant_authenticated_profile_lookup.sql`.
- 1 Storage bucket registration migration:
  `20260821082144_create_company_documents_storage_bucket.sql`.

`20260819130000_phase10_all_missing_modules.sql` is outside `supabase/migrations` as `.excluded` and is never part of the manifest. The final migration revokes browser-role execution of all existing public `SECURITY DEFINER` functions and closes the default `PUBLIC EXECUTE` privilege for functions subsequently created by that migration owner.

## Reproducible local runbook

Prerequisites: Docker Desktop running, Node.js 20+, pnpm, and no inherited hosted `SUPABASE_*` or `DATABASE_URL` values.

```powershell
$env:CI = 'true'
pnpm install --frozen-lockfile
.\node_modules\.bin\supabase.cmd start
.\node_modules\.bin\supabase.cmd db reset --local --no-seed

# Retrieve local-only values; do not use a hosted project's keys.
.\node_modules\.bin\supabase.cmd status -o env

# Dedicated destructive-test terminal only.
# `supabase_admin` is the local migration owner; do not substitute `postgres`.
# Use the local database password from `supabase status -o env`; never use a hosted credential.
$env:DATABASE_URL = 'postgresql://supabase_admin:<local-db-password>@127.0.0.1:54322/postgres'
$env:PGS_RELEASE_DB_DISPOSABLE = 'confirmed'
pnpm test:release-migrations
pnpm test:workflow-migrations
node scripts/seed-local-uat.mjs
```

Run API and web in separate terminals after the reset. Before starting either service, set its complete local configuration using the local values printed by `supabase status -o env`:

```powershell
# API terminal
$env:APP_ENV = 'test'
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:WEB_URL = 'http://localhost:3000'
$env:SUPABASE_PUBLISHABLE_KEY = '<local publishable key>'
$env:SUPABASE_SECRET_KEY = '<local service-role key>'
$env:INITIAL_ADMIN_EMAIL = 'admin@test.local'
pnpm dev:api

# Web terminal
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '<local publishable key>'
pnpm dev:web
```

The checked-in Supabase seed is intentionally no-op; `seed-local-uat.mjs` creates the deterministic `PGS Agency Test` organization, five requested accounts, team scope, project/service data, and the canonical 08:00–17:30 attendance policy.

Then execute:

```powershell
$env:APP_ENV = 'test'
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:WEB_URL = 'http://localhost:3000'
$env:SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
$env:SUPABASE_SECRET_KEY = 'test-secret-key'
$env:INITIAL_ADMIN_EMAIL = 'admin@test.local'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '<local publishable key>'
$env:PGS_RELEASE_DB_DISPOSABLE = 'confirmed'
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm test
node scripts/run-full-local-uat.mjs
node scripts/capture-screenshots.mjs
```

The UAT and screenshot scripts fail closed unless all configured endpoints are loopback. Screenshot capture requires explicit local `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SUPABASE_URL`, blocks non-loopback HTTP(S) and WebSocket requests before they leave the browser, and rejects redirects or an off-origin final page. The UAT runner validates returned storage signed URLs and rejects redirects before any upload or download.

## Current execution evidence

| Check                       | Result                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| Supabase CLI availability   | PASS — local CLI `2.111.0` installed                                   |
| Docker / local stack        | PASS — disposable Local Supabase Docker stack healthy on loopback      |
| Local DB reset              | PASS — `supabase db reset --local --no-seed` completed locally         |
| 57-migration preflight      | PASS — release verifier applied all 57 active migrations from empty DB |
| 47-workflow preflight       | PASS — workflow verifier applied all 47 workflow migrations cleanly    |
| API health endpoint         | PASS — isolated test-config API returned `status: ok`                  |
| Web home and login smoke    | PASS — both pages rendered in the local browser with no console errors |
| Seed, role UAT, screenshots | NOT RUN — application/UAT evidence is recorded separately              |

No production or hosted staging endpoint was contacted during this release-engineering run.
