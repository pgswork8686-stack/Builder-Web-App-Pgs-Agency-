# Release Readiness

## Recommendation: **NO-GO** for declaring PGS Hub production-ready on the basis of this audit

This is not a finding that the system is broken. It is a finding that the acceptance criteria cannot be shown to be met: most of them require a live database, a browser and authenticated roles, none of which were available.

## Acceptance criteria

| Criterion                                         | Status                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No known critical security/data-integrity defects | **Unknown** — RLS/five-role runtime tests not run. No _confirmed_ critical defect found. Fabricated financial KPIs shown to clients (FG-2) were a data-integrity/trust defect, now fixed in code |
| Approved modules use real backend data            | Partial — Tasks/Kanban/Calendar + Client KPIs fixed; leave KPIs (FG-3) still hard-coded; other dashboards not audited                                                                            |
| Five roles enforce server-side permissions        | NOT VERIFIED (new endpoint unit-tested only)                                                                                                                                                     |
| Tasks/Kanban/Calendar consistent                  | Implemented on one endpoint; NOT verified at runtime. Calendar omits leave & milestones                                                                                                          |
| Dashboard KPIs from authoritative data            | Partial (see above)                                                                                                                                                                              |
| Critical workflows pass DB-backed E2E             | **NOT RUN**                                                                                                                                                                                      |
| Responsive & accessibility defects resolved       | NOT VERIFIED                                                                                                                                                                                     |
| Quality gates pass                                | Partial — lint/format/typecheck/API unit/API build pass; **web tests and web build could not run here**                                                                                          |
| Deployment & rollback documented                  | Existing docs not rewritten in this pass                                                                                                                                                         |
| Remaining gaps identified                         | Yes — this folder                                                                                                                                                                                |

## Production

Reachable, healthy, auth enforced, CORS correct (`PRODUCTION_STATUS.md`). Deployed SHA, migrations, logs and authenticated behaviour NOT VERIFIED. Deploy order if released: **API before web** (new `GET /tasks`).

## Git delivery

- Repository history was **not cloned**: `git` over HTTPS is blocked on this machine (Application Control blocks `libcurl`) and the `gh` token is invalid. The source was downloaded as an archive of upstream `main` at `a07b74e502d5ce0e0b124df7982a60a2733a15fb` and imported into a fresh local repository as the baseline commit `35bbd1b`.
- Working branch: `audit/system-remediation` (local only). **Nothing has been pushed; no PR exists.** To deliver: re-authenticate (`gh auth login`), then `git remote add origin …`, and either push this branch and rebase onto upstream, or apply `git diff 35bbd1b..audit/system-remediation` to a real clone. Because this repo has unrelated history to upstream, applying the diff to a real clone is the safer route.
- Not merged, not deployed.

## Next steps (priority)

1. Run the full gates (incl. web test/build) in CI or on an unrestricted machine.
2. Stand up an isolated Supabase + seeded five-role users; run RBAC, RLS and the E2E workflow.
3. Fix FG-3, audit remaining dashboards, add a client-safe progress aggregation.
4. Add `/tasks` controller/e2e test and a deployed-SHA field to `/health`.
5. Rendered responsive/accessibility pass; consolidate `docs/release/*` as historical.
