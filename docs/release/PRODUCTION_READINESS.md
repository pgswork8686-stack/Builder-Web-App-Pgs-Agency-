# PGS Hub — Production readiness

**Current gate: `NO-GO` for production.** Source and CI/UAT quality are evidenced (see `RELEASE_EVIDENCE_MATRIX.md`); production and staging evidence does not exist yet. Missing access counts as not passed.

This file is the single status page. Older reports in this folder (`FINAL_ACCEPTANCE_REPORT.md`, `FINAL_GO_LIVE_REPORT.md`, `GO_LIVE_ACCEPTANCE_REPORT.md`, `FINAL_PRODUCTION_*`, `PHASE_*`, `*_AUDIT_2026-08-26.md`) are **historical**: they describe an earlier tree (PR #7 era) and must not be used as current evidence. `docs/audit/PRODUCTION_STATUS.md` and `docs/audit/RELEASE_READINESS.md` are dated 2026-10-16 (baseline `a07b74e`) and have been superseded by `FINAL_GAP_AUDIT.md`.

## Gates (spec section X)

| Gate                                                                  | Result                                                                                                                         | Basis                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 1 Source quality (lint, format, typecheck, unit tests, build)         | see `RELEASE_EVIDENCE_MATRIX.md` for the exact SHA                                                                             | CI quality-gates job                   |
| 2 Functional E2E (Flows 01–08, regression) on a disposable database   | see matrix                                                                                                                     | UAT workflow                           |
| 3 Security (RBAC, tenant isolation, dependency audit)                 | **PARTIAL** — dependency audit clean, RBAC asserted in Flows 01–08; full cross-client sweep not done (`FINAL_GAP_AUDIT.md` §3) |                                        |
| 4 Staging                                                             | **BLOCKED** — no staging environment                                                                                           | `PRODUCTION_PREFLIGHT_CHECKLIST.md` §4 |
| 5 Data safety (migration preflight, backup, restore drill)            | **BLOCKED / NOT PERFORMED**                                                                                                    | preflight §3                           |
| 6 Operational readiness (health checks, monitoring, runbooks, owners) | **PARTIAL** — runbooks written, health + release identification in code; monitoring and owners not set                         | preflight §5                           |
| 7 Release authorization                                               | **NOT GIVEN**                                                                                                                  | project owner                          |

Production GO requires every gate to pass.

## Environments

| Environment | Exists             | Used for                                                                                                                                     |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| LOCAL / CI  | yes                | disposable local Supabase inside the runner; all automated evidence                                                                          |
| STAGING     | **no**             | —                                                                                                                                            |
| PRODUCTION  | yes (not accessed) | web `https://hub.pgsagency.vn` (Vercel), API `https://apihub.pgsagency.vn/api/v1` (cPanel Passenger, Node 22.23.0), Supabase Auth/DB/Storage |

Never share secrets or databases between these. The UAT scripts refuse non-loopback hosts on purpose.

## Release identification

After the new build is deployed, `GET /api/v1/health` returns `release.sha` and `GET /api/release` returns the web SHA. Production currently exposes neither (verified absent on 2026-10-16). Do not claim a deployed version without reading the SHA back from the running service.

## Background processing

Workflow auto-tasks are created on the client-approval event and by an in-process safety-net sweep (`WORKFLOW_AUTOTASK_SWEEP_MS`, default 60 s). On cPanel Passenger the process can be stopped when idle, so an external uptime monitor on `/api/v1/health` is required. Details: `FINAL_GAP_AUDIT.md` §2.

## Documents

`PRODUCTION_PREFLIGHT_CHECKLIST.md` · `PRODUCTION_DEPLOYMENT_RUNBOOK.md` · `PRODUCTION_ROLLBACK_RUNBOOK.md` · `PRODUCTION_MIGRATION_MANIFEST.md` · `RELEASE_EVIDENCE_MATRIX.md` · `FINAL_UAT_ACCEPTANCE_2026-10-20.md` · `FINAL_GO_NO_GO.md` · `docs/adr/0001-task-completion-review-gate.md`.
