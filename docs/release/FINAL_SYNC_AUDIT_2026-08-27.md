# Final Synchronization Audit — 2026-08-27

## Scope and source evidence

- Repository: `pgs-hub`
- Audited branch / HEAD: `codex/production-hardening-2026-08-26` / `2964f8054113ec38ee5ce4d1f978037592c56c9b`
- Release tag: `v1.0.0-production`, attached to `2964f80`
- `main`: `444d7a8ba127a806023a6568db72b2325ae60206` (`origin/main` at the same SHA after `git fetch --all --prune`)
- Merge base: `444d7a8ba127a806023a6568db72b2325ae60206`
- Result: `main` is a strict ancestor of the release commit. The release is ten commits ahead and can be fast-forwarded without rewriting history once its gates pass.

## Workspace safety state

The release branch has no tracked modifications. A pre-existing untracked file named `h .artifactspgs-hub-api-cpanel.zip -Algorithm SHA256` was present before this audit. It was not read, changed, deleted, or treated as a release artifact.

## Release delta from `main`

`git diff --stat main..2964f80` reports 84 changed files, 5,865 insertions, and 482 deletions.

- Frontend: 10 files; 578 insertions and 184 deletions. The delta includes administrative people/client/project views, API clients, and the Next.js request proxy migration from `middleware.ts` to `proxy.ts`.
- Backend: 43 files; 3,244 insertions and 289 deletions. The delta includes environment validation, authorization/scope guards, people and project behavior, attendance/leave controls, and extensive unit/E2E coverage.
- Database: three new migrations plus Supabase configuration. They add client social links, security/RLS/index hardening, and safe account lifecycle helpers.
- Deployment/release: CI and cPanel artifact verification changes, deployment runbooks, secret-boundary checks, and release documents.

## Migration and production-risk classification

The migration delta is not data-backfill-only and must not be applied to production without an applied-migration check and an approved rollback plan:

- `20260824090000_add_client_social_links.sql` alters `client_companies`.
- `20260826024721_production_audit_hardening.sql` changes project constraints/indexes, enables RLS on RBAC tables, and alters grants. It contains `DROP INDEX IF EXISTS`, which is potentially availability-sensitive.
- `20260826032457_phase1_safe_account_lifecycle.sql` introduces two `SECURITY DEFINER` functions, explicitly revokes public/anon/authenticated execution, grants service-role execution, and includes targeted deletion of project memberships inside an account-replacement routine. This is a controlled business operation, not a migration-time bulk delete, but its authorization and live-data behavior require database validation before production use.

No migration was executed by this audit. Docker Desktop is installed but its daemon was unavailable, and the Supabase CLI was not available. The repository migration verifiers correctly refused to run without the explicit disposable-local database confirmation; this is a safe failure, not a PASS.

## Release-source and runtime observations

- Declared package manager: `pnpm@11.20.0`; installed version: `11.20.0`.
- Local Node: `v24.19.0`; cPanel artifact verifier requires exactly `v22.23.0`. Node 22.23.0 was not available on the current PATH or at the inspected standard install locations. Artifact runtime parity is therefore **not yet verified**.
- API: NestJS 11; frontend: Next.js 16.3.0; both use Supabase JS 2.112.2.
- `scripts/verify-secret-boundaries.mjs` checks that web examples do not expose service-role credentials and that Supabase config does not contain a concrete Google OAuth secret.

## Audit gate result

**Audit complete. Further release gates are documented in `FINAL_DEPLOYMENT_EVIDENCE.md` and `FINAL_PRODUCTION_UAT_REPORT.md`.**

`git diff --check main..2964f80` originally reported trailing whitespace in newly introduced release Markdown files. That defect was corrected, and `git diff --check main` plus Prettier check now pass. Local functional gates subsequently passed, but database and production deployment/UAT gates remain unverified and the public API invalid-origin CORS response is a blocking defect.
