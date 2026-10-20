# Production deployment runbook

**Status: PREPARED, NOT EXECUTED.** Nothing in this document has been run against production. Do not start until `PRODUCTION_PREFLIGHT_CHECKLIST.md` has no `BLOCKED` row that matters for this release and the project owner has approved a specific SHA in writing.

Topology (from `docs/release/FINAL_DEPLOYMENT_EVIDENCE.md` and the 2026-10-16 probe): web on Vercel (`https://hub.pgsagency.vn`), API on cPanel/LiteSpeed Passenger running Node `22.23.0` (`https://apihub.pgsagency.vn/api/v1`), database/Auth/Storage on Supabase. `docs/DEPLOYMENT.md` describes a Coolify layout; that is an alternative host, not the production path. Never print environment values, keys or tokens in any step.

## 0. Inputs and stop conditions

| Input               | Value                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Approved SHA        | `<TARGET_SHA>` (40 hex)                                                                          |
| API artifact        | `artifacts/pgs-hub-api-cpanel.zip` built from `<TARGET_SHA>`; SHA-256 recorded as `<ZIP_SHA256>` |
| Migrations to apply | the reviewed pending list from preflight 2.6, a subset of `PRODUCTION_MIGRATION_MANIFEST.md`     |
| Owners              | deploy `<name>`, database `<name>`, rollback `<name>`, product decision `<name>`                 |

Stop and do **not** continue if any of these is true: CI/UAT is not green on `<TARGET_SHA>`; a fresh backup is not confirmed; the pending migration list contains something nobody reviewed; the ZIP SHA differs from `<ZIP_SHA256>`; cPanel does not show Node `22.23.0`.

## 1. Order and why

1. **Database migrations** (additive, forward-compatible with the old API where possible).
2. **API** (cPanel). The new web calls endpoints that do not exist in the old API (`GET /tasks`, `GET /client/me/approvals`, finance ledger/receivables, handover, project completion check). The production probe on 2026-10-16 confirmed `GET /tasks` is absent.
3. **Web** (Vercel) only after the API is verified.
4. Deploy API and web **close together** (minutes, not days): the API enforces the task review gate (ADR 0001); the old web would show an error when an employee sets a task `done`.

## 2. Database

1. Record the current migration list (`supabase migration list --linked`) in the release notes.
2. Confirm the backup from preflight 3.1 and record its timestamp.
3. Apply only the reviewed pending migrations, in timestamp order, through the approved mechanism. No `db reset`, no `truncate`, no manual edits of already-applied migration files.
4. After each migration run the read-only verification for that migration. For the profiles grant use the SQL in `CPANEL_PROFILES_REPAIR_DEPLOYMENT_PROCEDURE.md` §4. For the workflow engine use `WORKFLOW_POSTFLIGHT.sql`.
5. If a migration fails: stop. Do not retry blindly. Follow `PRODUCTION_ROLLBACK_RUNBOOK.md` §Migration failure.

## 3. API (cPanel)

Follow `CPANEL_PROFILES_REPAIR_DEPLOYMENT_PROCEDURE.md` §2–§7 with these substitutions: `<TARGET_SHA>` and `<ZIP_SHA256>` for the old SHA/ZIP values, and the extra verification below.

1. In **Setup Node.js App** record `<APP_ROOT>`, Node version, startup file (`app.js`).
2. Copy the current application to a timestamped sibling backup directory and confirm it is readable (rollback material).
3. Upload the ZIP outside `<APP_ROOT>`, verify `sha256sum` equals `<ZIP_SHA256>`, extract to a fresh staging directory, confirm `DEPLOYMENT_INFO.txt` shows `SOURCE_SHA=<TARGET_SHA>`.
4. In the Node environment: `node --version` must be `v22.23.0`; run `npm ci --omit=dev --ignore-scripts` (the lockfile pins the patched `multer`, `qs`, `proxy-addr`, `engine.io`).
5. Confirm the required env **names** exist (list in preflight 2.10). Do not set `TASK_ALLOW_ASSIGNEE_DONE` unless the product owner chose to keep the old rule.
6. Swap the staged release into `<APP_ROOT>` keeping the cPanel-managed environment, then restart once.
7. Read stderr immediately; stop and roll back on a startup exception, env validation error or repeated worker restart.

### API smoke tests (all must pass)

```bash
curl -sS https://apihub.pgsagency.vn/api/v1/health
# expect: status "ok", service "pgs-hub-api", release.sha == <TARGET_SHA>
curl -sS -o /dev/null -w "%{http_code}\n" https://apihub.pgsagency.vn/api/v1/auth/me                # 401
curl -sS -o /dev/null -w "%{http_code}\n" -H "Origin: https://hub.pgsagency.vn" https://apihub.pgsagency.vn/api/v1/health   # 200
curl -sS -o /dev/null -w "%{http_code}\n" -H "Origin: https://evil.example" https://apihub.pgsagency.vn/api/v1/health       # 403 CORS_ORIGIN_DENIED
curl -sS -o /dev/null -w "%{http_code}\n" https://apihub.pgsagency.vn/api/v1/tasks                  # 401 (was 404 before this release)
```

`release.sha` comes from `DEPLOYMENT_INFO.txt` inside the artifact (or `RELEASE_SHA`); if it reads `unknown` or another SHA, the wrong build is live: roll back.

Then, with an authorised **non-production-data-affecting** test account (never print the token): `GET /auth/me` → 200; an employee cannot approve a task; a client cannot read `/projects/:id/tasks`. Record results.

## 4. Web (Vercel)

1. Ensure the Vercel production environment has only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no secret keys).
2. Deploy `<TARGET_SHA>` (promote the Vercel deployment built from that commit). Record the Vercel deployment URL/ID. `VERCEL_GIT_COMMIT_SHA` is set automatically.
3. Verify: `curl -sS https://hub.pgsagency.vn/api/release` → `service "pgs-hub-web"`, `release.sha == <TARGET_SHA>`; response headers include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
4. Smoke in a browser with a test account per role (Admin, Team Leader, Employee, Accountant, Client): sign in, open the home page, one list page, one detail page, sign out. Check the browser console for failed API calls.

## 5. Post-deploy watch (first 60 minutes, then per `PRODUCTION_OPERATION_PLAN.md`)

- `GET /api/v1/health` every minute for 10 minutes: always 200, same `release.sha`.
- No HTTP 5xx and no `permission denied` in cPanel stderr; no repeated Passenger restarts.
- Login works for each role; client approvals list loads; an accountant payment list loads.
- Notifications are not duplicated (watch for two identical rows per event).
- Record the first background sweep log line (`Auto-task sweep processed …`) when there was something to process, or confirm no errors.

## 6. Record

Fill the table in `RELEASE_EVIDENCE_MATRIX.md` ("Deployed version verification") with the **observed** values from steps 3–4. Do not write "deployed" before the SHA was read back from the running service.
