# PGS HUB — Final Acceptance Report

**Assessment date:** 2026-08-21
**Status:** **BLOCKED**

This report supersedes historical local-UAT claims for this release decision. It records only checks run against the remediation working tree based on the input SHA below; the resulting remediation commit is recorded after it is created.

## 1. Source SHA

| Check          | Result                                                    |
| -------------- | --------------------------------------------------------- |
| Input branch   | `feat/workflow-engine-v1`                                 |
| Input SHA      | `9807a0858a79d311f219b0337ac92f77eccf2b7a`                |
| Required state | `main` after PR #7 merge, clean worktree                  |
| Result         | **FAIL** — current source is a feature branch, not `main` |

## 2. Environment

| Item                          | Result                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| Hosted/production access      | PASS — none performed                                         |
| Test config isolation         | PASS — test URLs are loopback-only and enforced in validation |
| Local Supabase CLI            | PASS — `2.111.0` pinned and available                         |
| Docker / local Supabase stack | **BLOCKED** — unavailable on this workstation                 |
| API health endpoint           | PASS — isolated test-config API returned `status: ok`         |
| Web home/login smoke          | PASS — both pages rendered locally with no console errors     |

The reproducible environment and commands are in [FULL_SYSTEM_TEST_ENVIRONMENT.md](FULL_SYSTEM_TEST_ENVIRONMENT.md).

## 3. Migration status

| Check                                         | Result                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Legacy Phase 10 monolith                      | PASS — excluded from active migration directory and verifier manifest                                            |
| Active manifest                               | PASS (source inspection) — 54 migrations declared                                                                |
| `SECURITY DEFINER` execution hardening        | PASS (source inspection) — migration revokes current browser-role execution; future default applies to its owner |
| Clean database apply, RLS, indexes, triggers  | NOT RUN — requires a disposable local PostgreSQL/Supabase database                                               |
| Direct anon/authenticated SELECT/INSERT proof | NOT RUN — verifier strengthened but local DB unavailable                                                         |

## 4. Build and automated test result

| Gate                                         | Result                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS                                                             |
| Focused API config regression                | PASS — 1 suite, 3 tests                                          |
| Focused attendance regression                | PASS — 5 suites, 59 tests                                        |
| Focused expense/support RBAC regression      | PASS — 3 suites, 28 tests                                        |
| Focused web attendance API-client regression | PASS — 1 file, 8 tests                                           |
| `pnpm lint`                                  | PASS — warnings only (no errors)                                 |
| `pnpm format:check`                          | PASS                                                             |
| `pnpm typecheck`                             | PASS — all 7 workspace projects                                  |
| `pnpm build`                                 | PASS — API build and 86 Next.js routes                           |
| `pnpm test`                                  | PASS — 718 tests: API unit 544, API E2E 94, web 79, validation 1 |

## 5. Role matrix

| Role        | Static/focused verification                                                             | Full local UAT |
| ----------- | --------------------------------------------------------------------------------------- | -------------- |
| Admin       | Attendance settings is admin-only; support admin scope retained                         | NOT RUN        |
| Team Leader | Multi-team attendance scope; project-manager expense/support scope                      | NOT RUN        |
| Employee    | Project-member expense creation; own/assigned support scope; redacted attendance policy | NOT RUN        |
| Accountant  | Expense review preserved; support controller/service excluded                           | NOT RUN        |
| Client      | Expense/payroll/attendance policy denied; company/project support scope                 | NOT RUN        |

## 6. Module matrix

| Module                                 | Result                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| Auth and role login                    | Public/login page smoke PASS; authenticated role login NOT RUN  |
| Attendance boundary/GPS/history/report | Unit regression pass; live UAT NOT RUN                          |
| Workflow engine                        | Source verifier prepared; live migration/UAT NOT RUN            |
| Expenses                               | RBAC focused regression PASS; live approval flow NOT RUN        |
| Payroll                                | NOT RUN                                                         |
| Documents / signed URL                 | NOT RUN                                                         |
| Support / realtime                     | RBAC focused regression PASS; live ticket/realtime flow NOT RUN |
| Chat message delivery                  | NOT RUN                                                         |

## 7. Security result

- Test-mode Supabase and web URLs must be loopback; a hosted test URL now fails application validation.
- Destructive migration/UAT scripts require the known local Supabase database tuple plus `PGS_RELEASE_DB_DISPOSABLE=confirmed`; browser/UAT outbound URLs are validated as loopback and redirects are rejected.
- Both legacy `verify-live-*` scripts are disabled fail-closed so they cannot access or create users in a hosted project.
- A new migration removes browser-role `EXECUTE` on current public `SECURITY DEFINER` functions; its default-privilege rule applies to subsequent functions created by that migration owner. The release verifier checks current effective privilege plus direct business-table SELECT/INSERT isolation.

The database-level proof remains pending a local disposable database.

## 8. Screenshots

No screenshot is accepted as current evidence. A manual local browser smoke did render Home and Login without console errors, but it is not authenticated role evidence. The local capture script now covers Login, Dashboard, Attendance, Tasks, Kanban, Calendar, Workflow, Expenses, Payroll, Documents, and Support across the appropriate roles; it blocks non-loopback browser traffic before credential submission and fails on route, redirect, console, network, or local HTTP errors. It could not run without the local stack.

## 9. Bugs found and fixes applied

1. **Attendance policy split:** Admin UI wrote legacy `system_settings.attendance_policy` while runtime read `attendance_settings`. Fixed with canonical admin `GET/PATCH /attendance/settings`, strict DTO/service checks, and UI mapping.
2. **Attendance policy enforcement:** Timezone, GPS configuration completeness, and multi-team leader directory scope were hardened and regression-tested.
3. **Expense RBAC:** Employee arbitrary-project creation and leader global access were restricted to project membership/project-manager scope.
4. **Support RBAC:** Client company/project mismatch, broad internal read/reply/status access, and unauthorized assignment were restricted at controller and service layers.
5. **Unsafe release tooling:** Hosted live-verification scripts were disabled; destructive migration/UAT scripts now require an acknowledged, known local Supabase target before connecting.
6. **Database function privilege gap:** Added `20260821050134_harden_security_definer_functions.sql` and a verifier assertion.
7. **False-positive UAT/screenshot tooling:** Seed data now uses the requested accounts and canonical attendance policy; screenshot collection blocks hosted browser traffic and is fail-closed.

## 10. Remaining blockers

1. The working source is not `main` after PR #7 merge.
2. Docker/local Supabase is unavailable; therefore migration, RLS, authenticated role UAT, storage, sockets, and screenshot evidence have not run.

## Final status

```text
STATUS: BLOCKED
```

Do not promote this source or run any hosted verification until the source gate is satisfied, a disposable local environment completes the full matrix, and all remaining quality gates pass.
