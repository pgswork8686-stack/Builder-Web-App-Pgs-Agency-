# PGS HUB V1 — Phase 1 Implementation Record

**Date:** 2026-08-26  
**Baseline:** `PGS_HUB_CURRENT_STATE_AUDIT_2026-08-26.md`  
**Phase:** Fix Core Architecture

## Outcome

Phase 1 code and database hardening are implemented and verified. The production database migration is live. The new API/web code is built into a cPanel artifact but is **not yet deployed to Passenger**, so the live API must not be considered remediated until the artifact is uploaded and the application is restarted and smoke-tested.

## Implemented

### Safe account lifecycle

- Removed `DELETE /admin/people/:userId` from the Nest controller.
- Added `POST /admin/people/:userId/terminate` with UUID and Zod reason validation.
- Replaced the multi-step permanent delete with `phase1_terminate_account(...)`, one atomic service-role-only RPC.
- The RPC:
  - verifies an active admin actor;
  - blocks self-termination and termination of the last active admin;
  - locks actor and target rows;
  - clears current department/team/project/task/support/pending-approval ownership that requires reassignment;
  - terminates the employee profile and revokes active role assignments;
  - locks the account using the current supported `rejected` account state with an explicit `TERMINATED:` marker;
  - preserves the Auth user, project/client memberships, attendance, leave, payroll, finance, files, comments, chat, notifications, and audit history;
  - writes an account approval/audit event;
  - is idempotent for an already terminated account.
- Updated the admin UI wording and action: it now explains that access is terminated while business/audit history is retained.
- Removed all stale destructive references to nine non-existent tables and the wrong existing-table columns from runtime code.

### Atomic project membership replacement

- Replaced delete-then-insert assignment logic with `phase1_replace_user_project_memberships(...)`.
- The RPC validates actor/target/projects, protects required project-manager membership, computes a diff, and upserts/deletes as one transaction.

### Database least privilege

- Revoked broad anon/authenticated privileges from eight identified tables.
- Restored only `authenticated SELECT` on `profiles`, constrained by the existing own-profile RLS policy.
- Both new SECURITY DEFINER functions use an empty fixed search path.
- `PUBLIC`, `anon`, and `authenticated` cannot execute either function; only `service_role` can.

### API validation

Added `ParseUUIDPipe` to:

1. attendance record adjustment;
2. leave review;
3. leave cancellation;
4. leave balance adjustment;
5. work-calendar event update;
6. work-calendar event deletion.

The Leave e2e fixture was corrected to use a valid UUID for authorization testing, with a separate malformed-UUID `400` regression case.

### Windows/Node 22 artifact verification

The cPanel artifact test no longer uses `fs.cpSync`, which crashes Node 22.23.0 on Windows when the workspace path contains Unicode. It now copies files explicitly; Linux CI behavior is preserved.

## Production database record

- Migration: `20260826032457_phase1_safe_account_lifecycle`
- Local migrations: 64
- Remote migrations: 64
- Local-only: 0
- Remote-only: 0
- Production profile count after migration: 2 (unchanged by this implementation)
- Direct grants after migration: only `authenticated SELECT profiles` among the eight audited tables
- Security advisors: 68 informational backend-only RLS notices and 1 leaked-password-protection warning; no new warning
- Performance advisors: 134 informational unused-index notices; no new missing-FK-index or duplicate-index finding

## Verification

| Gate                                                         |                          Result |
| ------------------------------------------------------------ | ------------------------------: |
| Secret boundary scan                                         |                            PASS |
| API unit tests                                               |                    **602 PASS** |
| API e2e tests                                                |                     **97 PASS** |
| Web tests                                                    |                     **80 PASS** |
| Validation tests                                             |                      **1 PASS** |
| Total automated tests                                        |                    **780 PASS** |
| Typecheck (7 packages/apps)                                  |                            PASS |
| API lint (`--quiet`)                                         |                            PASS |
| Web lint (`--quiet`)                                         |                            PASS |
| Nest production build                                        |                            PASS |
| Next 16.3 production build                                   | PASS, 86 generated routes/pages |
| cPanel artifact secret scan                                  |                            PASS |
| Node 22.23.0 packaged startup/health/request ID/CORS/SIGTERM |                            PASS |
| Production env fail-fast matrix                              |                            PASS |

Artifact:

- File: `artifacts/pgs-hub-api-cpanel.zip`
- Size: 1,042,116 bytes
- SHA-256: `f8cc04b1359d5698f7e03dd6c5f70d9dc7a002adaaaee10ac3fc354336fb37ff`

## Explicitly not changed

- No production account was terminated.
- No business history was deleted.
- No missing production department or project manager was guessed/backfilled.
- No unused index was removed without workload evidence.
- RBAC runtime integration remains Phase 2.
- Task/project/file approval and customer sharing remain Phases 3–4.
- Attendance distance/device/accuracy persistence remains Phase 5.

## Release gate

1. Upload the verified artifact to the cPanel application root.
2. Run `npm ci --omit=dev --ignore-scripts` using Node 22.23.0 if dependencies are not uploaded as an installed runtime.
3. Confirm startup file `app.js` and restart Passenger.
4. Verify `/api/v1/health`, allowed/rejected CORS, request IDs, and logs.
5. Confirm the old `DELETE /api/v1/admin/people/:userId` returns `404` and the new terminate route is present for admin only.
6. Only after this smoke test mark the P0 account deletion incident as closed in production.
