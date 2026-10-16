# System Audit — Module Inventory

Baseline `a07b74e502d5ce0e0b124df7982a60a2733a15fb`. Working branch `audit/system-remediation`.
Verification levels: **L1** code read · **L2** automated unit tests (mocked DB) · **L3** local runtime with real DB · **L4** staging · **L5** production.
Only L1/L2 were achievable in this audit. **No module is verified at L3–L5.** Historical reports in `docs/release/` (e.g. `FINAL_GO_LIVE_REPORT.md`, `FINAL_PRODUCTION_UAT_REPORT.md`) were **not** relied upon.

## Repository

pnpm monorepo: `apps/web` (Next.js 16 / React 19), `apps/api` (NestJS 11), `packages/{api-client,config,types,ui,validation}`, `supabase/{migrations,policies,seed}`.

## Quality gates (baseline, before changes)

| Gate                             | Result                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS                                                                         |
| `pnpm lint`                      | PASS (0 errors; 267 API + 15 web warnings)                                   |
| `pnpm format:check`              | PASS                                                                         |
| `pnpm typecheck`                 | PASS                                                                         |
| `pnpm test` — web (vitest)       | **BLOCKED** by machine policy (native rollup binary)                         |
| `pnpm test` — API unit (jest)    | PASS via workaround: 67 suites / 620 tests (includes 5 added in this branch) |
| API e2e (`test/*.e2e-spec.ts`)   | NOT RUN                                                                      |
| `pnpm build` — api               | PASS                                                                         |
| `pnpm build` — web               | **BLOCKED** (native SWC / Turbopack blocked)                                 |

## API modules (NestJS controllers found)

admin, attendance, auth, automation, chat, clients, documents, expenses, finance, health, leave, notifications, organization (departments, teams), payroll, people, projects, services (+categories), settings, support, tasks, work-calendar, workflows (runtime, templates), workspace (comments, files, workspace). Level reached: **L1 only** except tasks (L2).

## Web areas under `apps/web/app/app`

accountant, admin, attendance, chat, client, employee, leave, notifications, profile, projects, team-leader.

| Area                                                  | Status                              | Notes                                                     |
| ----------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Admin / TL Tasks, Kanban, Calendar; Employee Calendar | Was static → now API-backed (L1/L2) | see FG-1                                                  |
| Employee Tasks                                        | Real API data (L1)                  | N+1 fetch across projects client-side; could use `/tasks` |
| Client Dashboard                                      | Fake KPIs removed (L1/L2)           | see FG-2                                                  |
| Leave pages                                           | Hard-coded KPI numbers              | FG-3 OPEN                                                 |
| All other modules                                     | Not individually assessed           | NOT VERIFIED                                              |

## Documentation consistency

`docs/release/` holds ~40 reports with overlapping "FINAL"/"GO-LIVE" claims dated 2026-08-26..29. They are **historical records**; current status is `docs/audit/RELEASE_READINESS.md`.
