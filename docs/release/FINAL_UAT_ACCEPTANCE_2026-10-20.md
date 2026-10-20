# Final UAT acceptance — 2026-10-20

Written from the evidence in `RELEASE_EVIDENCE_MATRIX.md`. Scope of every result: **disposable local Supabase in a CI runner, synthetic accounts**. This is not staging and not production acceptance.

## 1. Executive summary

| Item                 | Value                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System               | PGS Hub (Next.js web, NestJS API, Supabase)                                                                                                                                                                     |
| Candidate commit     | `429f111a2cc6405425ef0cb8fcb10c36d098ceb7` on `feat/pgs-audit-ux-uat` (PR #17, open)                                                                                                                            |
| Verified by          | GitHub Actions: UAT run 39362211127, CI runs 39362211107 / 39362214906, artifact 12237839838                                                                                                                    |
| Technical conclusion | The application passes all automated gates on a disposable database: quality gates, container, cPanel artifact, eight cross-role flows with database assertions, and 260 responsive/axe runs across five roles. |
| Not achieved         | No staging environment, no migration dry-run on production-like data, no backup/restore drill, no monitoring, no production inventory, no owner authorisation. Production release is therefore **NO-GO**.       |

Changes made in this phase (details in `FINAL_GAP_AUDIT.md`): critical dependency vulnerabilities patched (`next` 16.3.8 + overrides); deployed-version identification added (`/health` `release.sha`, `/api/release`); the browser gate widened from 76 to 260 runs and the defects it exposed fixed (86 unnamed controls, keyboard-unreachable scroll regions, contrast); accountant screens no longer call Admin-only endpoints; leave KPIs from real data; employee task page error handling; web security headers; Flow 08 added; release runbooks and an ADR written.

## 2. Matrix of the cross-role flows

`PASS` is written only where an assertion for that column exists in the flow's result file / script. "—" means the flow does not assert it (not that it was skipped).

| Flow                  | UI                                           | API                                                      | DB   | RBAC                                                            | Notification                  | E2E (refresh + re-login)       | Evidence                                                                                        |
| --------------------- | -------------------------------------------- | -------------------------------------------------------- | ---- | --------------------------------------------------------------- | ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| 01 Project init       | PASS                                         | PASS                                                     | PASS | PASS (non-member, other client, employee writes refused)        | PASS (default, others not)    | PASS                           | `flow01-results.json`, 12 steps                                                                 |
| 02 Task assignment    | PASS                                         | PASS                                                     | PASS | PASS (non-member read, employee create/reassign refused)        | PASS                          | PASS                           | `flow02`, 7 steps                                                                               |
| 03 Task execution     | PASS                                         | PASS                                                     | PASS | PASS (no self-approval, no foreign comment)                     | PASS (no double notification) | PASS                           | `flow03`, 8 steps                                                                               |
| 04 Internal review    | PASS                                         | PASS                                                     | PASS | PASS (employee cannot decide/annotate)                          | PASS                          | PASS                           | `flow04`, 9 steps (incl. workflow unlock `blocked → ready`, concurrent approvals)               |
| 05 Client acceptance  | PASS (browser flow)                          | PASS (13 steps)                                          | PASS | PASS (client sees only own data, 409 on second answer)          | PASS (default notifications)  | PASS                           | `flow05-results.json`, `flow05-ui` 9 steps                                                      |
| 06 Finance            | PASS                                         | PASS                                                     | PASS | PASS (403 for non-finance roles, client sees only own invoices) | PASS (expenses)               | PASS                           | `flow06`, 8 steps (duplicate reference 409, overpayment refused, two concurrent final payments) |
| 07 Handover and close | PASS                                         | PASS                                                     | PASS | PASS (clients cannot read project files, employees locked out)  | PASS                          | PASS                           | `flow07`, 9 steps (open work blocks acceptance 409, signed download byte-identical)             |
| 08 Resilience         | PASS (outage banner + retry, login redirect) | PASS (401 on bad token, 409 guard, 403/404 after revoke) | PASS | PASS                                                            | —                             | — (session expiry, re-sign-in) | `flow08`, 5 steps                                                                               |

Not asserted anywhere: rejection of a _client_ approval followed by a second client, cross-client reads on every client route, concurrent edits outside approvals and payments, kanban keyboard use.

## 3. CI / CD evidence

See `RELEASE_EVIDENCE_MATRIX.md` §2–§3 for run ids, links, artifact id and timestamps.

## 4. Accessibility and responsive

260 runs, 0 failing, widths 375/768/1024/1440, routes per role: admin 18, team leader 11, employee 11, accountant 14, client 11 (`responsive-results.json`). axe-core serious/critical is blocking. Limits: static routes only (detail pages are covered inside the flows), auth screens and landing page not in the sweep, no manual screen-reader pass, touch targets under 44 px and text under 12 px remain (OI-15, OI-16). WCAG conformance is **not** claimed; only "no serious/critical axe violation on the swept routes".

## 5. Security and RBAC

Evidenced: server-side role guards and tenant isolation assertions in Flows 01–08; Admin permissions were **not** widened to hide any 403 (the accountant defects were fixed by using existing endpoints or removing the call); dependency audit clean after the upgrade; secret-boundary check passes (`pnpm test:security-boundaries`); web security headers verified on a running `next start` (this phase); API headers (helmet, CSP in production, HSTS, strict CORS) reviewed in `apps/api/src/main.ts` and last observed on production on 2026-10-16 (`docs/audit/PRODUCTION_STATUS.md`), not re-probed now; no secret in CI output (fail-fast container test checks the secret marker never appears).
Not evidenced: penetration testing, rate-limit behaviour under load, storage policy review on the real project, signed-URL expiry on production (code uses 120 s for project/handover downloads and 3600 s for company documents), WebSocket authentication tests beyond what the flows touch, CSP (not set).

## 6. Production readiness

`PRODUCTION_READINESS.md` (status page), `PRODUCTION_PREFLIGHT_CHECKLIST.md` (rows with status), `PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `PRODUCTION_ROLLBACK_RUNBOOK.md`, `PRODUCTION_MIGRATION_MANIFEST.md` (65 migrations; 62–65 added to the manifest). Summary: runbooks and release identification are ready; **inventory, staging, data safety, monitoring and authorisation are not**.

## 7. Open risks

| ID   | Class         | Risk                                                             | Impact                                                      | Owner          | Mitigation                                           |
| ---- | ------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| R-01 | P1            | Production state unknown (deployed SHA, applied migrations, env) | A deploy may meet an unexpected schema                      | database owner | Run preflight 2.x read-only before anything          |
| R-02 | P1            | No tested restore                                                | Data loss cannot be bounded; RTO/RPO unmeasured             | database owner | Restore drill into an isolated project               |
| R-03 | P1            | No staging                                                       | First authenticated run on a real stack would be production | project owner  | Provision staging (E-02)                             |
| R-04 | P1            | No monitoring; auto-task sweep is in-process                     | Outage or stuck workflows undetected                        | ops            | Uptime monitor on `/api/v1/health`                   |
| R-05 | P1 / decision | Accountant customer directory (F-05)                             | Menu entry leads to an explanatory page                     | product owner  | Decide: remove entry or approve a read-only endpoint |
| R-06 | P2            | Migration 63 builds ~25 indexes without `CONCURRENTLY`           | Brief write locks on large tables                           | database owner | Measure row counts on a restored copy                |
| R-07 | P3            | No CSP; text <12 px; touch targets <44 px; Kanban keyboard       | Hardening / accessibility gaps                              | frontend       | Post-release backlog                                 |

## 8. Product owner decisions

| Decision                                                                                                                  | Status                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Employee cannot set a task to `done`; Team Leader/manager approves (ADR 0001, `TASK_ALLOW_ASSIGNEE_DONE` rollback switch) | **PENDING PRODUCT OWNER APPROVAL**                                                                                                                     |
| Accountant access to the customer directory (F-05)                                                                        | **PENDING**                                                                                                                                            |
| Gold–white palette migration and removal of the landing page (design decision recorded in the Figma work)                 | Palette migration exists only in a separate local working tree and is **not part of this branch or this evidence**; the landing page is unchanged here |
| Authorisation of a specific SHA and plan for production                                                                   | **NOT GIVEN**                                                                                                                                          |

## 9. GO / NO-GO

- `LOCAL/CI UAT: PASS`
- `STAGING ACCEPTANCE: BLOCKED` (no environment)
- `PRODUCTION RELEASE: NO-GO`

See `FINAL_GO_NO_GO.md` for the conditions that must change.
