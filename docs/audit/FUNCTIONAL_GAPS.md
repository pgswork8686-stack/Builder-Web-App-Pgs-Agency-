# Functional Gaps

Baseline `a07b74e`. Status key: **FIXED** (code + automated test in this branch), **OPEN**, **NOT VERIFIED**.
"FIXED" means implemented and covered by the tests named; it has **not** been verified against a live database or in a browser (see `IMPLEMENTATION_REPORT.md`, verification limits).

## FG-1 — Aggregate Tasks / Kanban / Calendar were static shells — FIXED (code), runtime NOT VERIFIED

- Severity: High (core module non-functional)
- Files: `apps/web/app/app/admin/{tasks,kanban,calendar}/page.tsx`, `apps/web/app/app/team-leader/{tasks,kanban,calendar}/page.tsx`, `apps/web/app/app/employee/calendar/page.tsx`
- Root cause: The API only exposed `GET /projects/:projectId/tasks`; there was no cross-project endpoint, so these pages rendered hard-coded empty lists, Kanban columns fixed at `0`, and an empty `MonthCalendar`.
- Remediation: New `GET /tasks` (`AggregateTasksController`), shared `AggregateTaskList` / `AggregateKanban` / `AggregateCalendar` components; writes go through the existing per-project `PATCH` (permission + atomic RPC unchanged).
- Tests: `tasks.service.spec.ts` › `getAggregateTasks` (5 tests). `task-meta.test.ts` written, **not run** (see limits).
- Remaining risk: Kanban loads the 100 nearest-due tasks (column counts are exact via `includeCounts`); drag-and-drop and status persistence have not been exercised in a browser; project milestones and leave schedules are **not** shown on the calendar (no milestone source identified; leave API not integrated).

## FG-2 — Client Dashboard fabricated KPIs — FIXED (code), runtime NOT VERIFIED

- Severity: High (misleading financial information shown to clients)
- File: `apps/web/app/app/client/page.tsx` (was lines 134 and 149)
- Root cause: `Tiến độ tổng` rendered the literal `"100%"` whenever the client had ≥1 project; `Công nợ còn lại` rendered the literal `0 ₫`.
- Remediation: Debt = Σ(amount − paid_amount) over client-visible invoices in `issued | partially_paid | overdue`, per currency (`lib/client-dashboard-kpis.ts`). The fake percentage was **not** replaced by another invented one: the card is now "completed projects / total projects" computed from real project statuses. Loading (`…`) and error (`—` + message) states added.
- Tests: `client-dashboard-kpis.test.ts` (written, **not run**).
- Remaining risks: (a) no authoritative task-based progress exists for clients — tasks are internal-only, so a true % needs a new client-safe backend aggregation (OPEN); (b) the invoice list is fetched without explicit pagination, so the sum covers only the first page if a client has more invoices than the API default page size (needs check/endpoint-side aggregate).

## FG-3 — Hard-coded numbers in leave pages — OPEN

- Severity: Medium
- Files: `apps/web/app/app/leave/page.tsx:193` (`value="12 ngày"`), `apps/web/app/app/admin/leave/page.tsx:166,172,178` (`"18"`, `"02"`, `"04"`)
- Root cause: literal KPI values in JSX. Needs leave-balance / leave-request aggregations from the leave module.
- Not changed in this branch.

## FG-4 — Other dashboards not audited — NOT VERIFIED

Admin, Team Leader, Employee and Accountant dashboard KPIs were not individually traced to database sources. Only a grep for literal numeric `value=` props across `app/app/**/page.tsx` was done (found FG-3 only); that does not prove the other values are real.

## FG-5 — Tooling: web tests/build cannot run on the audit machine — ENVIRONMENT

- Windows Application Control policy blocks native `.node` binaries (`@rollup/rollup-win32-x64-msvc`, `@next/swc-win32-x64-msvc`, `unrs-resolver`). Result: `pnpm --filter web test` and `next build` fail locally; API Jest only runs with a JS shim of `unrs-resolver` in a throw-away mirror. These are machine limits, not repository defects — run the gates in CI or on an unrestricted machine.
