# Final GO / NO-GO

Date: 2026-10-20. Candidate: PR #17, branch `feat/pgs-audit-ux-uat`, application code as of `429f111a2cc6405425ef0cb8fcb10c36d098ceb7`.

## Decision

| Scope              | Result                                      |
| ------------------ | ------------------------------------------- |
| LOCAL/CI UAT       | **PASS**                                    |
| STAGING ACCEPTANCE | **BLOCKED** (no staging environment exists) |
| PRODUCTION RELEASE | **NO-GO**                                   |

Do **not** merge PR #17 and do **not** deploy to production on the strength of this document. Nothing was deployed, no migration was applied anywhere, no production secret or database was touched, and `main` was not changed.

## Gates

| #   | Gate                  | Result        | Evidence / reason                                                                                                                                                                           |
| --- | --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Source quality        | **PASS**      | CI runs 39362211107 and 39362214906 on `429f111`: lint, format, typecheck, test, build, API container, cPanel Node 22 artifact all success                                                  |
| 2   | Functional E2E        | **PASS**      | UAT run 39362211127: Flows 01–08 PASS with Postgres assertions; artifact 12237839838                                                                                                        |
| 3   | Security              | **PARTIAL**   | Dependency audit clean (0 / 0 after fixes), RBAC and isolation asserted in the flows, no permission widened. Not done: full cross-client sweep on every client route, penetration test, CSP |
| 4   | Staging               | **BLOCKED**   | No staging project, API or web deployment; UAT scripts refuse non-loopback hosts by design                                                                                                  |
| 5   | Data safety           | **BLOCKED**   | Migration dry-run, backup state and restore drill not performed (no access); migration manifest completed (62–65 added)                                                                     |
| 6   | Operational readiness | **PARTIAL**   | Runbooks, health endpoint with release SHA, web release endpoint written and tested; monitoring, alerting and named owners absent                                                           |
| 7   | Release authorization | **NOT GIVEN** | Project owner has approved no SHA or plan                                                                                                                                                   |

## What must change for GO

1. Production inventory read (read-only): deployed web/API SHA, applied migrations vs the 65 in the manifest, env names, Auth redirect URLs. (E-01)
2. A staging environment exists, the release build runs on it, authenticated UAT for the five roles passes there. (E-02)
3. A fresh backup is confirmed and a restore into an isolated project has been performed and timed; migrations 44–65 (the applicable subset) rehearsed on that copy. (E-03)
4. An uptime/5xx monitor with an alert is live on `/api/v1/health`. (E-04)
5. Product-owner answers recorded: task completion rule (ADR 0001), accountant customer directory (F-05).
6. Owners named for deploy, database, rollback and the first 14 days.
7. Written approval of a specific SHA and of `PRODUCTION_DEPLOYMENT_RUNBOOK.md`. (E-05)

## Minimum access / decisions requested (no secrets over chat)

| Need                                                                                                                                             | Why                          | Form                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Read-only view of Vercel deployments (production), cPanel Setup Node.js App, Supabase dashboard (migrations list, backups/PITR, Auth URL config) | Gate 4–6 evidence, inventory | Viewer invitations, or screenshots / exported lists pasted by the owner |
| Permission to create a separate Supabase project for staging (and its Vercel/cPanel counterpart)                                                 | Gate 4–5                     | Owner decision; credentials stay in the owner's secret store            |
| Answers to the two product questions above                                                                                                       | Close F-05 and ADR 0001      | One-line replies                                                        |
| Names of the deploy, database and rollback owners                                                                                                | Runbooks                     | Names                                                                   |

## Commit history of this phase (for traceability)

| Commit      | Content                                                                   | Evidence                                                                  |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `06d45d4`   | dependency CVEs, release identification, wider browser gate, Flow 08      | CI green; UAT red (70 findings by the widened gate — all addressed below) |
| `26c8ce1`   | a11y, accountant 403s, leave KPIs, employee tasks, headers, runbooks, ADR | CI green; UAT red only on Flow 08 (wrong target)                          |
| `00ab2cb`   | Flow 08 target, gap audit, readiness page                                 | CI green; UAT red only on Flow 08 step 4 (real guard)                     |
| `429f111`   | Flow 08 respects the assigned-task guard                                  | **CI and UAT green**                                                      |
| this commit | documentation and `pnpm audit` CI step                                    | see below                                                                 |

The last commit only changes documentation and the CI workflow (adds `pnpm audit --prod --audit-level=high`); its own CI runs are on the PR #17 checks page. Application code evidence is exactly that of `429f111` (RELEASE_EVIDENCE_MATRIX.md). If any later commit touches application code, the evidence must be regenerated for that SHA.
