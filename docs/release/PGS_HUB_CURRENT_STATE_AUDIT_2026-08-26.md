# PGS HUB V1 — Current-State Audit

**Audit date:** 2026-08-26 (Asia/Ho_Chi_Minh)  
**Repository:** `pgs-hub`, branch `main`, HEAD `444d7a8ba127a806023a6568db72b2325ae60206`  
**Production database:** Supabase project `umtgfaqjoqbsdzwpqizq`, PostgreSQL 17.6  
**Production URLs:** `https://hub.pgsagency.vn`, `https://apihub.pgsagency.vn`

## 0. Audit boundary and evidence

This report is the mutation boundary requested by the product owner: repository, production schema, API routes, frontend routes/components, deployment configuration, tests, and production health were inspected before starting the next fix phase.

The working tree was already dirty when this baseline was locked. A production-hardening migration and code changes had also been made before the explicit “scan first” instruction. Therefore this is a report of the **current state**, not a reconstruction of the pristine state at HEAD. No code or database fix was applied between starting this scan and writing this report.

Evidence set:

- 570 source/config/documentation files inventoried after excluding dependencies and generated output.
- 63 local migrations and 63 remote migrations; no local-only or remote-only migration.
- 69 public tables, 1,197 columns, 514 constraints, 393 indexes, 169 public functions, 180 non-internal triggers, 14 public views, and 3 private storage buckets inspected.
- 28 NestJS controllers and 216 REST routes enumerated from source.
- 99 Next.js `page.tsx` routes, 53 shared component files, and 31 frontend API-library files inventoried.
- Current verification result: 773 tests pass (599 API unit, 94 API e2e, 79 web, 1 validation); lint, typecheck, Nest build, and Next production build pass.
- Production recheck at report time: frontend `200`, API root `404` (no Passenger “It works” page), API health `200` on LiteSpeed. A disallowed `Origin` currently yields `500` without ACAO, so the built CORS hardening is not yet the behavior deployed on the live API.

## 1. System Health Report

| Module                        | Current problem                                                                                                                                                                                                                                                                  |                   Severity | Evidence / impact                                                                                                                                                                                                                                        | Recommended solution                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| People / account lifecycle    | `deletePerson()` permanently deletes Auth and business history through many non-transactional calls; failures are swallowed with `Promise.allSettled`.                                                                                                                           |            **P0 Critical** | `people.service.ts:792-996`. Production PostgreSQL logs show failed deletes against non-existent columns on 2026-08-26. The API can report success after partial deletion.                                                                               | Replace hard delete with atomic account deactivation/termination. Preserve financial, attendance, leave, approval, chat, task, and audit history. Keep a separately authorized, audited purge process only for legal/retention use. |
| People / schema drift         | The deletion path references 9 tables that do not exist: `calendar_events`, `payroll_records`, `expenses`, `reimbursements`, `task_attachments`, `task_activity_logs`, `chat_participants`, `chat_reads`, `direct_conversations`; it also uses wrong columns on existing tables. |            **P0 Critical** | Actual schema uses `company_work_calendar_events`, `payslips`, `project_expenses`, `chat_members`; `account_approval_events` uses `target_user`/`actor`, `support_tickets` uses `creator_user_id`, and `task_comments` uses `author_user_id`.            | Remove stale table knowledge from application code. Centralize account termination in one audited database RPC with explicit FK behavior and regression tests generated from the live schema.                                       |
| RBAC                          | A complete seed model exists (5 roles, 21 permissions, 48 grants, scopes `global/department/own/client`) but the API and frontend do not consume it.                                                                                                                             |        **P0 Architecture** | No runtime source references to `role_permissions` or `user_role_assignments`; `RolesGuard`, services, layout, and navigation use hard-coded role strings. Permission changes in the database have no effect.                                            | Introduce a capability resolver in AuthGuard/request context, a permission+scope guard, and one scope-query service. Keep role only as a default bundle, not the authorization decision.                                            |
| Data scope                    | Scope is implemented inconsistently per service. Several sensitive modules correctly check service-level scope, but there is no common enforcement contract.                                                                                                                     |                **P1 High** | Finance, Tasks, Files, Comments, Leave, Attendance, and Workflow contain independent checks. 48 routes have no explicit `@Roles` and depend entirely on service logic.                                                                                   | Define permission/scope policies once, enforce them before handlers, and retain service-level resource checks as defense in depth. Add cross-role e2e matrices.                                                                     |
| Database grants               | `anon` and `authenticated` have all seven table privileges on 8 tables, despite RLS denying most direct access.                                                                                                                                                                  |                **P1 High** | Affected: `client_companies`, `client_memberships`, `departments`, `employee_profiles`, `profiles`, `service_department_assignments`, `service_team_assignments`, `teams`. RLS prevents current direct exploitation, but grants violate least privilege. | Revoke broad grants; grant only the minimum required direct access (currently authenticated own-profile read). Preserve service-role backend access.                                                                                |
| Organization integrity        | Current production data contains one active team-leader assignment without a department; the only project has neither department nor manager.                                                                                                                                    |                **P1 High** | Exact counts: 1 team-leader missing department; 1 active role assignment missing department; 1/1 project missing department and project manager.                                                                                                         | Backfill relationships after business-owner confirmation, then add lifecycle validation/constraints so active leaders and operational projects cannot remain unscoped.                                                              |
| Project lifecycle             | Project entity and statuses exist, but `department_id` and manager are nullable and there is no complete project-approval transition flow.                                                                                                                                       |                **P1 High** | Status enum includes Draft, Pending Approval, Active, On Hold, Completed, Archived (plus Cancelled). No generalized project approval record/action is wired.                                                                                             | Add atomic submit/approve/revise transitions, scope-aware approver selection, audit events, and activation constraints.                                                                                                             |
| Task lifecycle                | Tasks correctly require `project_id`, but the requested review lifecycle is incomplete.                                                                                                                                                                                          |                **P1 High** | Current enum: `todo`, `in_progress`, `review`, `done`, `cancelled`; it lacks `need_revision` and `approved`.                                                                                                                                             | Add an explicit state machine and task approval history. Do not encode approval only as a mutable status field.                                                                                                                     |
| File/content/customer sharing | Project files support secure upload/download/delete but have no approval or customer-visibility fields/workflow.                                                                                                                                                                 |                **P1 High** | `project_files` contains storage and deletion state only. Existing workflow approvals attach to workflow/stage/item, not arbitrary files/content/project sharing.                                                                                        | Add approval subject/type support, visibility/share records, approved artifact version, approver, timestamps, and customer-safe listing endpoints.                                                                                  |
| Customer privacy              | Internal Tasks, Files, and Comments deny client access correctly; Workflow and Finance provide scoped client reads. The requested customer artifact-sharing portal is still incomplete.                                                                                          |                **P1 High** | Service-level checks prevent current broad exposure. Missing approved-file/share model means the intended feature cannot be safely operated.                                                                                                             | Preserve deny-by-default and expose only immutable approved artifacts/progress through dedicated portal projections.                                                                                                                |
| Aggregate Task UI             | Admin and team-leader task list/Kanban pages are static empty shells, not data-backed operational views.                                                                                                                                                                         |                **P1 High** | `/app/admin/tasks`, `/app/admin/kanban`, `/app/team-leader/tasks`, `/app/team-leader/kanban` render zero/empty content without API calls.                                                                                                                | Build one scoped task query and reuse its result/model across list and Kanban; add pagination/filter contracts for organization and department views.                                                                               |
| Calendar UI                   | Admin, team-leader, and employee aggregate calendars render only a date grid.                                                                                                                                                                                                    |                **P1 High** | `MonthCalendar` has no data input/API call. Project-level calendar is real and uses task data, but aggregate calendars do not.                                                                                                                           | Provide a scoped task deadline feed from the same task table/query model; merge company/leave events as typed overlays, not separate task sources.                                                                                  |
| Attendance GPS                | Backend computes Haversine and enforces the production 150 m geofence at the requested coordinates. Evidence persistence is incomplete.                                                                                                                                          |                **P1 High** | DB stores coordinates/accuracy but not calculated distance or device metadata. Frontend reads only lat/lng and does not submit `position.coords.accuracy`; backend has no maximum-accuracy policy.                                                       | Persist check-in/out distance, accuracy, source/device metadata and policy version; submit browser accuracy and reject/flag measurements above a configurable threshold.                                                            |
| API input validation          | Body DTOs are Zod-validated, including file finalize/upload helper paths. Six ID parameters lack `ParseUUIDPipe`.                                                                                                                                                                |                **P1 High** | Attendance adjustment; leave review/cancel/balance adjustment; work-calendar event update/delete.                                                                                                                                                        | Add UUID pipes and negative e2e cases consistently.                                                                                                                                                                                 |
| API response contract         | Error responses are centrally structured; successful responses are heterogeneous raw values.                                                                                                                                                                                     |              **P1 Medium** | No global `{ success, data, message, error }` envelope across 216 routes.                                                                                                                                                                                | Adopt a versioned success interceptor/envelope and update the generated/shared API client together; avoid a partial per-controller rollout.                                                                                         |
| Frontend authorization        | Protected layout and navigation are hard-coded by role, not resolved capabilities.                                                                                                                                                                                               |                **P1 High** | `app/app/layout.tsx` uses route-prefix maps; `role-navigation.ts` uses static role menus. DB permission changes cannot hide/show actions.                                                                                                                | Load capabilities once with `/auth/me`, use shared permission keys for routes/nav/actions, and always keep API enforcement authoritative.                                                                                           |
| Session error handling        | SSR proxy refreshes claims and initial layout checks the session, but the central API client does not centrally handle `401`.                                                                                                                                                    |              **P2 Medium** | Requests throw `ApiError`; expired/revoked sessions rely on each screen or next navigation to recover.                                                                                                                                                   | Add a single unauthorized handler with refresh-once semantics, safe sign-out, and redirect preserving the intended route.                                                                                                           |
| Frontend resilience           | No App Router `loading.tsx`, `error.tsx`, or `global-error.tsx` exists.                                                                                                                                                                                                          |              **P2 Medium** | Local loading/error states exist in many client components, but unhandled route/render failures have no segment boundary.                                                                                                                                | Add global and protected-area boundaries, then focused boundaries for finance/workflow/project routes.                                                                                                                              |
| Frontend API consistency      | Three domain clients duplicate authenticated fetch logic; the central client and UI contain extensive `any`.                                                                                                                                                                     |              **P2 Medium** | Duplicate helpers in `clients.ts`, `organization.ts`, `people.ts`; 197 `any` references in web source.                                                                                                                                                   | Consolidate transport, generate/derive response types, and eliminate `any` at API boundaries first.                                                                                                                                 |
| Frontend test coverage        | Build and 79 web tests pass, but route behavior coverage is narrow.                                                                                                                                                                                                              |              **P2 Medium** | 99 pages; only one colocated page test. A route-matrix Playwright script exists but was not executed against a fixture environment during the frozen audit.                                                                                              | Make the route matrix a required UAT job with disposable seeded data and capture role/action evidence.                                                                                                                              |
| Web security/performance      | API has Helmet/rate limit/CORS; web Next config is empty and no dynamic imports are used.                                                                                                                                                                                        |              **P2 Medium** | No explicit web security headers/CSP; 110 client components/pages; 0 `dynamic()` imports.                                                                                                                                                                | Add deploy-safe security headers, measure bundles, and split heavy workflow/finance/project workspaces based on measured chunks.                                                                                                    |
| Supabase Auth                 | Leaked-password protection is disabled.                                                                                                                                                                                                                                          |              **P2 Medium** | Supabase security advisor reports one warning.                                                                                                                                                                                                           | Enable leaked-password protection after confirming login UX/support messaging.                                                                                                                                                      |
| RLS model                     | All 69 tables have RLS; 68 have no policies and therefore deny direct client access.                                                                                                                                                                                             | **Info / design decision** | Backend uses service role and only `profiles` has authenticated own-read policy. This is secure-by-default, but operationally dependent on the API.                                                                                                      | Document this as the backend-only data-access architecture; do not add blanket policies to silence the advisor.                                                                                                                     |
| Database performance          | No missing FK index or duplicate-index advisor warning remains; 134 indexes are currently unused.                                                                                                                                                                                |           **P2 / observe** | Production dataset is very small, so unused-index evidence is not yet representative.                                                                                                                                                                    | Keep until realistic telemetry exists; review write overhead after 30–60 days and remove only with workload evidence.                                                                                                               |
| Documentation                 | Existing `docs/UI_BACKEND_GAPS.md` claims zero backend gaps and contains stale screen/migration counts.                                                                                                                                                                          |              **P2 Medium** | Current scan found material gaps and 63 migrations.                                                                                                                                                                                                      | Replace point-in-time claims with generated inventories and link this baseline.                                                                                                                                                     |

### Known-good controls

- Supabase Auth bearer-token flow, Google OAuth callback, SSR cookie refresh proxy, backend JWT verification, active-account checks, logout paths.
- API Helmet, CORS configuration, global throttling, ValidationPipe, structured exception filter, request IDs, production env fail-fast validation.
- All public tables have primary keys and RLS; 188 FKs and all FK indexes are present; SECURITY DEFINER functions are locked to fixed search paths and not executable by anon/authenticated.
- All 14 public views are `security_invoker=true` and not readable by anon/authenticated.
- Storage buckets are private and allowlist file types/sizes; workspace file delete has mark/remove/finalize and restore-on-failure semantics.
- Client company deletion is deactivation and project deletion is archival in the current working tree.

## 2. Database Change Plan

### Phase 1 — integrity and least privilege

1. Replace account deletion with an atomic `terminate_account(...)` RPC that:
   - locks the profile;
   - revokes active role assignments and memberships according to explicit policy;
   - clears only operational assignments that must be reassigned;
   - preserves immutable business/audit history;
   - writes an audit event;
   - fails as one transaction.
2. Revoke excess anon/authenticated grants from the 8 identified tables.
3. Backfill the production leader/project department/manager gaps after confirming correct owners.
4. Add constraints/transition guards preventing new active unscoped leaders and operational projects.

### Phase 2 — permission and scope

1. Make `user_role_assignments`, `roles`, `role_permissions`, and `permissions` the runtime source of capabilities.
2. Represent scope bindings explicitly (global, department IDs, project IDs, own, client company IDs).
3. Add indexed helper functions or views for effective permissions without granting direct client table access.
4. Record role/scope changes in an immutable audit trail.

### Phase 3/4 — project, task, approvals, sharing

1. Add atomic project state transitions and project approval records.
2. Extend task workflow with submit-review, request-revision, approve, and complete transitions plus decision history.
3. Generalize approval subjects to project/task/file/content/customer_share while retaining workflow-stage approvals.
4. Add artifact version/approval/share visibility records; never expose internal comments/tasks through customer projections.

### Phase 5 — attendance evidence

Add distance, device/source metadata, geofence-policy snapshot, and accuracy decision fields for both check-in and check-out. Calculate authoritative values inside the database RPC or pass only server-calculated values into a locked RPC.

### Migration policy

- Forward-only, idempotent migrations with preflight queries and explicit rollback/compensation notes.
- Test on a disposable/local database first; compare local/remote migration ledgers before and after.
- Never rewrite already-applied migration files.

## 3. API Change Plan

1. **Phase 1:** remove `DELETE /admin/people/:userId` hard-delete semantics; introduce termination/deactivation and audit response. Add regression cases for every retained FK/history category.
2. **Phase 2:** add `PermissionGuard` + `ScopeGuard`, resolved capability context, and standardized scope query helpers. Convert modules route-by-route while retaining service resource checks.
3. **Phase 3:** add scoped organization/department task aggregation for list/Kanban/calendar from one task query contract.
4. **Phase 4:** add explicit submit/approve/revise/share actions; use atomic RPC transitions and idempotency protections.
5. **Phase 5:** persist full attendance evidence and expose safe admin/self views.
6. **Phase 6:** introduce success envelopes, shared pagination metadata, OpenAPI/generated types, measured caching, and query telemetry.
7. Add `ParseUUIDPipe` to the six inconsistent ID routes and negative tests early in Phase 1.

## 4. Frontend Change Plan

1. Replace role-prefix authorization and static menus with capabilities returned from `/auth/me`.
2. Remove static aggregate task/Kanban/calendar shells. Use one typed scoped task datasource with view adapters only.
3. Implement task/project/file approval actions with buttons rendered from capabilities and current transition state.
4. Build a dedicated customer portal projection for approved/shared artifacts only.
5. Submit GPS accuracy and device/source metadata; display accuracy and geofence decision without trusting client distance.
6. Consolidate API transport and centralized 401 recovery.
7. Add App Router error/loading boundaries and route-matrix UAT.
8. Measure and split heavy client bundles; add web security headers compatible with Supabase/Auth/Socket.IO.

## 5. Permission Matrix

The following is the target runtime matrix. The database already contains matching permission keys for most rows, but runtime enforcement is not yet connected.

| Capability / scope             | Admin         | Team leader                               | Employee                              | Accountant                | Client                                   |
| ------------------------------ | ------------- | ----------------------------------------- | ------------------------------------- | ------------------------- | ---------------------------------------- |
| System/user administration     | Global        | No                                        | No                                    | No                        | No                                       |
| Project read                   | Global        | Own department / membership               | Membership                            | Read-only as required     | Own client company, shared projection    |
| Project create/update/members  | Global        | Own department                            | No                                    | No                        | No                                       |
| Project approve/archive        | Global        | Own department, separation-of-duty policy | No                                    | No                        | No                                       |
| Task read                      | Global        | Own department/projects                   | Assigned/member projects              | Only explicitly assigned  | No internal task access                  |
| Task create/assign/review      | Global        | Own department/projects                   | No                                    | No                        | No                                       |
| Task status update             | Global        | Own department/projects                   | Own assigned tasks, valid transitions | No                        | No                                       |
| File upload/comment            | Global        | Own department/projects                   | Member projects                       | Member projects if needed | No internal workspace                    |
| File/content approve and share | Global        | Own department/projects                   | No                                    | No                        | Respond only to explicit client approval |
| Attendance                     | Global review | Own department review + self              | Self                                  | Self                      | No                                       |
| Finance                        | Global        | No unless explicit permission             | No                                    | Global finance            | Own company, client-visible records only |
| Customer portal                | Global        | Preview scoped output                     | No                                    | No                        | Own company, approved/shared only        |

Every allow decision must combine **permission + scope + resource state**. UI visibility is advisory; the API remains authoritative.

## 6. Workflow Diagrams

### Target task review

```text
Employee creates/works task
        |
        v
Todo -> In Progress -> Review
                         |
              +----------+-----------+
              |                      |
              v                      v
        Need Revision             Approved
              |                      |
              +-> In Progress        v
                                    Done

Every transition: permission + scope + assignee/project checks + audit event
```

### Target file/content customer sharing

```text
Internal upload/version
        |
        v
Internal review request
        |
   +----+-----+
   |          |
Reject/Revise Approve
   |          |
   +-> upload  v
         Customer-share approval
                  |
                  v
       immutable shared artifact record
                  |
                  v
      customer portal scoped by company
```

### Target project approval

```text
Draft -> Pending Approval -> Active -> On Hold -> Active -> Completed -> Archived
             |                 |
             +-> Revision -----+

Activation requires department, manager, client, members/services policy, and approved decision.
```

## 7. Implementation Plan

| Phase                        | Outcome                                                                           | Primary deliverables                                                                                                                   | Exit gate                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **1. Fix Core Architecture** | No partial destructive operations; schema/code/deployment contracts align.        | Account termination RPC/API/UI; grant hardening; relationship backfill/constraints; six UUID validation fixes; CI/schema drift checks. | Full tests/build pass; production-like termination regression; no invalid table/column references; migration advisors reviewed. |
| **2. RBAC + Scope**          | Database capabilities drive API and UI consistently.                              | Capability resolver, permission/scope guards, shared scope service, `/auth/me` capabilities, dynamic nav/actions, role matrix e2e.     | All sensitive routes covered by permission+scope tests for five roles; cross-department/client isolation proven.                |
| **3. Project + Task**        | Projects/tasks are complete operational modules with one datasource across views. | Project constraints/transitions; scoped aggregate task API; real list/Kanban/calendar; task state machine.                             | Same task IDs/status/deadlines verified in all views; pagination and scope regression pass.                                     |
| **4. Approval Workflow**     | Important actions require auditable approval.                                     | General approval subject model; task/project/file/content/share transitions; customer-safe projections.                                | Employee cannot self-approve/share; leader/admin scope enforced; customer sees only approved shared versions.                   |
| **5. Attendance**            | GPS evidence is authoritative and auditable.                                      | Accuracy/device/distance persistence; policy snapshot; frontend accuracy capture; admin/self views.                                    | Haversine boundary, low-accuracy, missing-GPS, tampering, timezone, and duplicate action tests pass.                            |
| **6. Optimization**          | Production observability, performance, resilience, and consistent contracts.      | Response envelope/generated client, route boundaries, bundle splitting, security headers, query/bundle metrics, index review.          | CI + route UAT + production smoke pass; measured budgets and rollback checklist documented.                                     |

## Release decision

**Current decision: NOT production-ready for the requested 50–200 employee operating model.**

The deployed system is reachable and many security primitives are sound, but Phase 1 must block further release because account deletion can partially and permanently destroy business data, and the existing RBAC schema is not the runtime authorization source. Aggregate task views, approval/customer sharing, and complete attendance evidence are also not operationally complete.
