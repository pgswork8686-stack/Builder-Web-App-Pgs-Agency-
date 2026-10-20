# Production rollback runbook

**Status: PREPARED, NOT REHEARSED.** None of these procedures has been executed on production or on a restored copy. Rehearse them on staging (preflight §4) before relying on them.

Principles: roll back **code** freely, roll back **data** almost never. Migrations in this repository are additive; prefer a reviewed forward-fix over undoing a migration. Never run `db reset`, `truncate` or a restore over the live production database. Never revoke the `profiles` SELECT grant to "undo" an API rollback: the user-scoped AuthGuard needs it (`CPANEL_PROFILES_REPAIR_DEPLOYMENT_PROCEDURE.md`).

## Triggers (any one starts this runbook)

HTTP 5xx or health not 200 for more than 2 minutes · `release.sha` does not match the approved SHA · login fails for a role · a role gets 403 on a page it previously used · duplicate notifications · wrong financial figure or a payment/expense written twice · Passenger restarting repeatedly.

First action is always: **stop making changes, note the time, tell the owners, keep the logs.**

## Decision table

| Situation                                                         | Action                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API deployed OK, **web failed**                                   | Leave the API. The old web still works with the new API except one thing: an employee cannot set a task to `done` (the review gate). If that is unacceptable, set `TASK_ALLOW_ASSIGNEE_DONE=true` on the API and restart (see below). Redeploy the web fix or promote the previous Vercel deployment. |
| Web deployed OK, **API failed**                                   | Roll the API back (below) first. The new web calls endpoints the old API lacks (e.g. `GET /tasks`), so promote the **previous** Vercel deployment too (Vercel → Deployments → previous → Promote) until the API is fixed.                                                                             |
| **Migration failed**                                              | See §Migration failure. Do not deploy the API or web.                                                                                                                                                                                                                                                 |
| **Background jobs** misbehave (tasks created twice, sweep errors) | Set `WORKFLOW_AUTOTASK_SWEEP_MS=0` and restart: the safety-net timer stops; event-driven creation still runs. Duplicates are prevented by `workflow_create_primary_task` and a partial unique index, so a real duplicate means a bug: collect log lines and the affected item ids.                    |
| **Auth** broken (everyone gets 401)                               | Check Supabase Auth status, `SUPABASE_URL`/keys **names** present, `JWT_SECRET`, clock skew. If the cause is the new build, roll the API back. Do not touch Auth settings in a hurry.                                                                                                                 |
| One role gets unexpected **403**                                  | Do not widen permissions to hide it. Reproduce with that role's test account, compare with `docs/ROLE_MATRIX.md`, roll back if it is a regression.                                                                                                                                                    |
| **Duplicate notifications**                                       | Roll the API back; identify the event type from `notifications.type`; no data repair without the owner's approval.                                                                                                                                                                                    |
| **Financial data** wrong or written twice                         | Stop writes to finance (take the API offline or roll back), snapshot the affected tables read-only, involve the accountant and the owner. Fix by a reviewed corrective migration or documented manual correction, never by a bulk update.                                                             |
| Database latency up                                               | Check Supabase advisors/logs; if caused by new indexes being built, wait; otherwise roll the API back.                                                                                                                                                                                                |

## Roll back the API (cPanel)

1. In **Setup Node.js App** note the current state.
2. Stop the new worker. Restore the preserved application copy (created in the deployment runbook step 3.2) into `<APP_ROOT>`; restore the previous startup/root configuration if it changed.
3. If the old release needs its locked dependencies, run `npm ci --omit=dev --ignore-scripts` from the restored directory under Node `22.23.0`.
4. Restart once.
5. Verify: `GET /api/v1/health` is 200 and `cat DEPLOYMENT_INFO.txt` shows the **previous** SHA (the old build has no `release` field in `/health`; that is expected). `GET /api/v1/auth/me` without token → 401.
6. Keep the failed release directory and its logs.

## Roll back the web (Vercel)

Promote the previous production deployment (Deployments → select → **Promote to Production**). Verify the page loads, sign-in works, and `GET /api/release` returns the previous SHA (or 404 if that build predates the endpoint).

## Task completion rule (compatibility switch)

If the owner rejects ADR 0001 or it blocks work in production, set `TASK_ALLOW_ASSIGNEE_DONE=true` in the API environment and restart. No code change or migration is needed. Record the decision in the ADR.

## Migration failure

1. Stop. Do not re-run or edit the migration file.
2. Read the exact SQL error. Determine whether the migration ran in a transaction (most files here run in one implicitly via the migration runner; confirm) and what state the database is in with read-only queries.
3. If nothing was applied: fix forward with a **new** migration file, rehearse it on staging/restored copy, then apply.
4. If part of it was applied: do not guess. Compare with the preflight snapshot of the migration list and the table definitions, write a corrective migration, rehearse it, apply it.
5. A data-affecting emergency (corruption, wrong data written) is the only case for restoring from backup. Restore **into a new isolated project**, validate there, then plan the cut-over with the owner (connection strings and Auth/Storage consistency make this a project-level operation). PITR restore onto the live project overwrites newer data: owner approval required.
6. Record time, cause, and the fix in `FINAL_GO_NO_GO.md` appendix or the incident log.

## Recovery targets

RTO/RPO are **unmeasured**. The 14-day plan quotes RPO < 1 min / RTO < 15 min, which comes from a document written without a restore (`BACKUP_RECOVERY_REPORT.md`). Replace those numbers with the result of the restore drill (preflight 3.3) before quoting them.

## Owners

Fill in before approval: deploy `<name>`, database `<name>`, rollback authority `<name>`, product decision `<name>`, on-call (first 14 days) `<name>`.
