# Release evidence matrix

Every value below was read from GitHub Actions or from a command run on 2026-10-20; nothing is copied from older reports. **UAT runs on a disposable Supabase stack inside the CI runner with synthetic accounts. It is not staging and not production.**

Repository `pgswork8686-stack/Builder-Web-App-Pgs-Agency-`, branch `feat/pgs-audit-ux-uat`, PR #17 (open, mergeable, **not merged**).

## 1. Release candidate

| Item                                  | Value                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate commit (all evidence below) | `429f111a2cc6405425ef0cb8fcb10c36d098ceb7`                                                                                                                                    |
| Previous verified baseline            | `d88c750fc3e94f04ad69569f9b85f4ef8b05d0ca` (CI + UAT green, run 39236704015; 76 responsive runs, Flows 01–07)                                                                 |
| Later commits                         | Documentation and CI-workflow changes only (listed in `FINAL_GO_NO_GO.md`); the application code of `429f111` is unchanged. Re-run evidence for the final SHA is added there. |

## 2. Workflow runs on `429f111`

| Run         | Workflow                        | Event        | Result  | Link                                                                                      |
| ----------- | ------------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------- |
| 39362211127 | UAT (disposable local Supabase) | push         | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39362211127 |
| 39362211107 | CI                              | push         | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39362211107 |
| 39362214906 | CI                              | pull_request | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39362214906 |

CI jobs (both CI runs): Quality gates (lint, format, typecheck, test, build) success; API production container (build, smoke `/health` + graceful SIGTERM, fail-fast environment validation) success; cPanel Node 22.23.0 artifact (build, secret scan, packaged-API smoke) success. The container and artifact checks also assert that `/api/v1/health` `release.sha` equals the commit.

Evidence artifact: `uat-evidence`, id **12237839838**, 20.5 MB, created 2026-10-20T03:15:18Z (retention per repository setting). Contains per-flow JSON results, 283 screenshots, `responsive-results.json`, `responsive-summary.md`, API/web logs.

## 3. Functional E2E (artifact `12237839838`)

Each flow drives the real UI with Playwright, asserts Postgres after every business step and notifications, and checks refresh / brand-new login and 375/768 px + axe where noted in the step list.

| Flow                            | Script                                | Result | Steps | Started → finished (UTC) |
| ------------------------------- | ------------------------------------- | ------ | ----- | ------------------------ |
| 01 Project init                 | `scripts/uat-flow01-project-init.mjs` | PASS   | 12    | 03:13:35 → 03:13:56      |
| 02 Task assignment              | `uat-flow02-task-assignment.mjs`      | PASS   | 7     | 03:13:57 → 03:14:12      |
| 03 Task execution               | `uat-flow03-task-execution.mjs`       | PASS   | 8     | 03:14:13 → 03:14:24      |
| 04 Internal review              | `uat-flow04-internal-review.mjs`      | PASS   | 9     | 03:14:25 → 03:14:38      |
| 05 Client acceptance (API + DB) | `uat-flow05-client-acceptance.mjs`    | PASS   | 13    | 03:13:19 → 03:13:20      |
| 05 Client acceptance (browser)  | `uat-flow05-ui.mjs`                   | PASS   | 9     | 03:13:21 → 03:13:34      |
| 06 Finance                      | `uat-flow06-finance.mjs`              | PASS   | 8     | 03:14:39 → 03:14:51      |
| 07 Handover and close           | `uat-flow07-handover-close.mjs`       | PASS   | 9     | 03:14:51 → 03:15:09      |
| 08 Resilience (new)             | `uat-flow08-resilience.mjs`           | PASS   | 5     | 03:15:10 → 03:15:15      |

Flow 02 and Flow 03 record the note "using the project/task created by the previous flow". Flows 01, 04–08 have no notes. Flow 08 failed twice on earlier commits for reasons in the test, not the product (wrong endpoint blocked; a real guard `PROJECT_MEMBER_HAS_ASSIGNED_TASKS` it had to respect): runs 39355896350, 39359789443, 39360980421.

## 4. Responsive and accessibility (artifact `12237839838`)

260 page × width runs, **0 failing**: widths 375 / 768 / 1024 / 1440; admin 18 routes (72 runs), team leader 11 routes (44), employee 11 (44), accountant 14 (56), client 11 (44). Per run: HTTP status and final URL, horizontal overflow, console errors, failed API calls, accessible names, `h1`/`lang`, and axe-core serious/critical violations (gate on). The previous gate covered 76 runs and one accountant route; the widening is what exposed the defects in `FINAL_GAP_AUDIT.md` F-03/F-04 (70 failing runs on `06d45d4` before the fixes).

Not covered: dynamic routes with ids (project/task/invoice detail pages are exercised inside the flows, not in this sweep), the landing page, the auth screens, keyboard operation of Kanban, touch-target size.

## 5. Dependency security

| Check                                                               | When                      | Result                                                                                          |
| ------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm audit --prod` before                                          | 2026-10-20                | 21 vulnerabilities (4 critical, 8 high, 7 moderate, 2 low)                                      |
| `npm audit --omit=dev` in `packaging/cpanel-api` before             | same                      | 5 (1 critical, 3 high, 1 moderate)                                                              |
| after (`next` 16.3.8, workspace overrides, patched cPanel lockfile) | same, local               | 0 and 0                                                                                         |
| CI gate                                                             | added in the final commit | `pnpm audit --prod --audit-level=high` in Quality gates; result recorded in `FINAL_GO_NO_GO.md` |

## 6. Deployed version verification (spec E2)

| Component                           | Current deployed SHA                                                                                                 | Target SHA                       | Verified |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------- |
| Web (`hub.pgsagency.vn`)            | not readable — production exposes no release endpoint yet; author's network could not resolve the host on 2026-10-20 | final SHA in `FINAL_GO_NO_GO.md` | **NO**   |
| API (`apihub.pgsagency.vn`)         | not readable — `/health` has no SHA in the deployed build (confirmed absent on 2026-10-16)                           | same                             | **NO**   |
| Database migrations                 | not read (no database access)                                                                                        | repository has 66 migrations     | **NO**   |
| Background worker (auto-task sweep) | runs inside the API process                                                                                          | —                                | **NO**   |

## 7. Migration 66 and Staging database (2026-10-20)

Commit `60963f20e74c68fac316c2d359879f964f76d1f0` adds `20261020120000_revoke_client_grants_service_catalog_tables.sql` (revokes `anon`/`authenticated` grants on three service catalog tables). Application code is unchanged from `429f111`.

| Run         | Workflow                        | Event        | Result  | Link                                                                                      |
| ----------- | ------------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------- |
| 39387891305 | UAT (disposable local Supabase) | push         | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39387891305 |
| 39387891320 | CI                              | push         | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39387891320 |
| 39387898052 | CI                              | pull_request | success | https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39387898052 |

UAT run 39387891305: release + workflow migration verifiers (66 migrations, new grant assertions), Flows 01–08 and the five-role responsive/axe capture all success; evidence artifact `uat-evidence` id **12249095828**.

Local gates on the same tree: lint, typecheck, API 693/693, web 145/145, API and web build, `format:check` — all pass.

Staging database `PGS-Hub-Staging` (`silwoecgxpvwotkfhgxf`): 66/66 migrations applied, privileges verified before/after; details in `STAGING_DATABASE_DEPLOYMENT_REPORT.md`. **Staging Web/API and Staging E2E: not deployed / not run.**

## 8. Not done and why

Staging Web/API + Staging UAT, migration dry-run on a production-like copy, backup/restore drill, monitoring and alerting: no access or no environment (`PRODUCTION_PREFLIGHT_CHECKLIST.md`). They are **blocked**, not passed.
