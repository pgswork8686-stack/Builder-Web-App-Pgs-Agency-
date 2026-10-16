# RBAC & Security Matrix

**Scope reached: code-level review of the new endpoint + unit tests with mocked DB. No runtime, RLS or cross-role testing against a real database was performed.** Every cell not marked "unit-tested" is NOT VERIFIED.

## New endpoint: `GET /api/v1/tasks` (this branch)

Guards: `AuthGuard` → `ActiveAccountGuard` → `RolesGuard`, roles `admin | team_leader | employee | accountant`.

| Role                                      | Expected                                                                                       | Evidence                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated                           | 401                                                                                            | Same guard stack as `GET /projects` which returned 401 in production (route itself not deployed → 404 today). Not tested locally. |
| Pending / rejected account                | blocked by `ActiveAccountGuard`                                                                | Existing guard, L1 only                                                                                                           |
| Admin                                     | all projects                                                                                   | unit-tested (`lets admin see all projects and applies filters`)                                                                   |
| Team Leader / Employee / Accountant       | only projects where they hold a `project_memberships` row (same rule as per-project endpoints) | unit-tested (`scopes non-admin users…`, `returns an empty page…`)                                                                 |
| Same, requesting a non-member `projectId` | 403 `PROJECT_ACCESS_DENIED`                                                                    | unit-tested                                                                                                                       |
| Client                                    | blocked by `@Roles` (403) and defensively in service                                           | unit-tested (`rejects clients`)                                                                                                   |

`canUpdateStatus` per task = admin, or non-viewer who is project manager or the assignee — mirrors `updateTask`. Status changes still go through `PATCH /projects/:projectId/tasks/:taskId` which enforces the real permission server-side; the flag is UI-only.

## Observations (not exhaustively verified)

- **Department/team scoping:** a Team Leader sees tasks of _projects they are a member of_, not "all tasks of their department". Whether that matches the intended business rule is an open product question. RISK: Medium.
- **ILIKE filter:** `q` is passed to `ilike '%q%'`; `%`/`_` are not escaped so a user can widen their own search only (no scope escape because project scope is applied separately). Low.
- **Service role client:** the API uses `getSystemClient()` (service role) for task queries, so Postgres RLS is **bypassed** for these reads; authorization relies entirely on the application-level scoping above. This is the pre-existing pattern; RLS correctness was not tested.
- **Production:** unauthenticated `GET /projects` → 401; CORS rejects a foreign origin with 403 (see `PRODUCTION_STATUS.md`).

## Not tested (all roles)

Login/logout/session persistence, pending→active→rejected transitions, frontend route guards, RLS policies in `supabase/policies`, client-company isolation, payroll/finance confidentiality, individual-vs-department data. Status: **NOT VERIFIED** (needs an isolated Supabase project with seeded users for the five roles).
