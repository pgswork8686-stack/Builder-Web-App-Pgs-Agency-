# PGS Hub — Staging Database Deployment Report

Date: 2026-10-20
Operator: Supabase CLI 2.111.0 from a developer workstation (`pgs-release-work` clone), owner-authenticated via `supabase login`.

## Summary

| Hạng mục             | Bằng chứng                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project Staging      | `PGS-Hub-Staging` — ref `silwoecgxpvwotkfhgxf` (ap-southeast-1, ACTIVE_HEALTHY). `supabase/.temp/project-ref` = `silwoecgxpvwotkfhgxf`; `projects list` shows `linked:true` only for this ref |
| Commit triển khai    | `22ffb16e56e421abcb7652a33c575872ac48fcd1` (branch `feat/pgs-audit-ux-uat`, clean working tree)                                                                                               |
| Migration dự kiến    | 65 `.sql` files in `supabase/migrations/`                                                                                                                                                     |
| Migration thực tế    | 65 rows in `supabase_migrations.schema_migrations`, versions `20260810170000` … `20260828021004`; `migration list --linked` shows local = remote for all 65                                   |
| PostgreSQL           | 17.11 (`server_version`)                                                                                                                                                                      |
| Database schema      | PASS — see Schema section                                                                                                                                                                     |
| RLS                  | PASS with finding F1 (see Findings)                                                                                                                                                           |
| Authentication       | PASS (database layer). Sign-up → profile flow not exercised end-to-end (no Web/API)                                                                                                           |
| Storage              | PASS — 3 private buckets, no client policies on `storage.objects`                                                                                                                             |
| Security Advisors    | NOT RUN — Supabase Advisors not reachable from CLI in this session; equivalent read-only SQL checks run instead (see Security)                                                                |
| Performance Advisors | NOT RUN — same reason; `supabase db lint` run instead (warnings only, no errors)                                                                                                              |
| Web/API Staging      | BLOCKED — no Vercel project or long-running Node/Docker host authorized; no staging URLs exist yet                                                                                            |
| Staging E2E          | NOT RUN — requires Web/API Staging. Prior GitHub CI E2E is disposable-environment evidence only                                                                                               |
| Production           | UNCHANGED — ref `umtgfaqjoqbsdzwpqizq` never linked or queried (`linked:false`)                                                                                                               |

## Execution log

1. Pre-checks: remote `pgswork8686-stack/Builder-Web-App-Pgs-Agency-`, branch `feat/pgs-audit-ux-uat`, HEAD `22ffb16`, `git status` clean, 65 migrations, `supabase/config.toml` present. Node v24.20.0, pnpm 11.20.0, Supabase CLI 2.111.0.
2. Migration review (static): no `DROP TABLE`, `DROP SCHEMA` or `TRUNCATE` statements. `DELETE` statements are scoped (inside functions, or `20260819120000_clean_verification_test_data.sql` which only deletes `event_key='evt_test_12345'` / rule `'Auto Rule Test TDH'` — a no-op on an empty database; post-apply both tables have 0 rows).
3. `supabase migration list --linked` before apply: 65 local, 0 remote.
4. `supabase db push --linked --dry-run`: 65 pending, `seeds: []`, `roles: []`.
5. Target re-verified (ref file + HEAD SHA) immediately before apply.
6. `supabase db push --linked --yes`: exit 0, all 65 migrations applied in order, no errors. No `db reset`, no `migration repair`, no migration edits.

## Schema (read-only `supabase db query --linked`)

| Object                            | Count                                   |
| --------------------------------- | --------------------------------------- |
| Tables in `public`                | 69 (all with RLS enabled)               |
| Views in `public`                 | 14 (none selectable by `authenticated`) |
| Functions in `public`             | 170 (44 `SECURITY DEFINER`)             |
| Non-internal triggers in `public` | 180                                     |
| Enums in `public`                 | 18                                      |
| Foreign keys in `public`          | 188                                     |
| Indexes in `public`               | 385                                     |
| RLS policies in `public`          | 1                                       |

`public.profiles`, `public.projects`, `public.tasks` present. Reference/seed migrations (service catalog DV01–DV26, departments, work calendar) applied as part of the official history.

## Authentication

- `public.profiles` exists, RLS enabled.
- Policy `profiles_select_own_policy`: `SELECT` to `authenticated` using `(SELECT auth.uid()) = id`.
- `authenticated` has `SELECT` on `profiles`; `anon` does not.
- Trigger `on_auth_user_created` on `auth.users` (profile provisioning).
- `auth.users` = 0, `public.profiles` = 0. No Production admin or client account created.

## Storage

| Bucket                | Public | Size limit | MIME allow-list           |
| --------------------- | ------ | ---------- | ------------------------- |
| `company-documents`   | false  | 50 MB      | none                      |
| `project-files`       | false  | 25 MB      | images, PDF, Office, text |
| `attendance-evidence` | false  | 5 MB       | jpeg/png/webp             |

`storage.objects` has 0 policies → no anon/authenticated direct access; objects are reachable only via the server-side API (secret key) / signed URLs.

## Security checks (SQL equivalents of advisor lints)

- Tables without RLS in `public`: 0.
- `SECURITY DEFINER` functions without a fixed `search_path`: 0.
- `SECURITY DEFINER` functions executable by `anon`: 0.
- Views selectable by `authenticated`: 0.
- Access model: deny-by-default RLS; business data is served by the NestJS API with the server-side key. Only `profiles` (own row) is client-readable.

### Findings

- **F1 (low, hardening):** `anon` and default table grants include `INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` on `service_categories`, `service_delivery_items`, `project_service_items`. RLS is enabled with 0 policies, so row access via PostgREST is denied; however `TRUNCATE` is not governed by RLS (PostgREST does not expose `TRUNCATE`, so not reachable through the Data API). Recommend a follow-up migration revoking `anon`/`authenticated` table privileges on these three tables, applied first to Staging. Not changed here: the release instruction forbids altering migration history to pass checks, and Production likely has the same grants.
- **F2 (info):** `supabase db lint --level warning`: unused/shadowed variable warnings in `public.move_task_on_board` and `public.workflow_create_primary_task`. No errors.

## Web/API preparation

- Supabase endpoint: `https://silwoecgxpvwotkfhgxf.supabase.co`.
- Web (build-time, public): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Staging publishable key from the Staging dashboard).
- API (server secrets): `APP_ENV`, `WEB_URL`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`. `SUPABASE_SECRET_KEY` / `JWT_SECRET` must never be set on the web project.
- Auth redirect allow-list: add the real Staging web URL once it exists. No URL invented here.
- API host must be long-running Node.js/Docker (WebSocket + background scheduler); a Vercel Preview cannot host it.

## Remaining blockers

1. Web/API Staging hosting not provisioned (BLOCKED).
2. Synthetic Staging accounts for the 5 roles not seeded (requires API / staging-only tooling).
3. Supabase Security/Performance Advisors to be reviewed in the dashboard.
4. Flows 01–08 must not be declared PASS on Staging until E2E runs against Staging Web/API.

PR #17 not merged; Production not deployed.
