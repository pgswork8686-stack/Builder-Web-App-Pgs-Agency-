# cPanel Profiles Repair Deployment Procedure

- **Prepared:** 2026-08-28T10:29:30+07:00
- **Execution status:** NOT VERIFIED — `CPANEL_DEPLOYMENT_ACCESS = BLOCKED`
- **Artifact source:** `7b64b92a8eb786d9a7245e9a436ffdd8c2c53256`
- **Artifact SHA-256:** `a816d820a3ec9b65877c595b83c29c0cdad652a4feca9629147d20bf103b5aca`
- **Database migration:** `20260828021004_repair_authenticated_profiles_select.sql`

Do not deploy the frontend separately. Do not restart Passenger until the existing backend and database backup evidence are recorded. Never print environment values or access tokens.

## 1. Required access and stop conditions

Obtain authorized access to:

- cPanel **Setup Node.js App**, File Manager, and Terminal;
- the linked Supabase project migration history and SQL execution surface;
- the production backup/PITR status;
- a non-destructive authenticated smoke-test account.

Stop without changing production if any of these checks fail:

- the actual cPanel application root cannot be read from **Setup Node.js App**;
- the configured Node runtime is not exactly `22.23.0`;
- a recoverable copy of the current application is not complete;
- current database backup/PITR evidence is unavailable;
- the pending migration list contains an unreviewed migration;
- the uploaded ZIP SHA differs from the value above;
- required production environment variable names are missing.

## 2. Resolve and record the live application

In **Setup Node.js App**, record without guessing:

- application root as `<APP_ROOT>`;
- application URL;
- startup file;
- Node version;
- the cPanel command used to enter the application's Node virtual environment.

Expected startup file: `app.js`. Do not use a path from an old report if it differs from the value currently shown by cPanel.

Before making changes, record:

```bash
cd "<APP_ROOT>"
pwd
node --version
sha256sum DEPLOYMENT_INFO.txt 2>/dev/null || true
```

Do not display `.env` or cPanel environment values.

## 3. Preserve rollback material

Create a timestamped sibling backup outside `<APP_ROOT>` and copy the current application into it. Do not delete or overwrite the source directory.

```bash
mkdir -p "<APP_PARENT>/backups"
cp -a "<APP_ROOT>" "<APP_PARENT>/backups/pgs-hub-api-pre-7b64b92-<UTC_TIMESTAMP>"
```

Record the backup path, its file count, and the SHA-256 of any currently deployed ZIP or `DEPLOYMENT_INFO.txt`. Confirm the backup can be read before continuing.

In Supabase, record that the provider backup/PITR state is healthy before applying SQL. Do not run reset, truncate, delete, or business-data backfill operations.

## 4. Validate and apply the database migration

Inspect the linked migration history first:

```bash
pnpm exec supabase migration list --linked
```

Stop if the pending set is not exactly the reviewed chronological set. In particular, do not bulk-apply unknown August 24/26 migrations merely to reach the profiles repair.

Apply `supabase/migrations/20260828021004_repair_authenticated_profiles_select.sql` through the approved Supabase migration mechanism. The applied SQL must remain exactly the committed migration: RLS enabled, authenticated `SELECT` only, and no service-role bypass or write grant.

Verify with read-only SQL:

```sql
SELECT
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS authenticated_select,
  has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_select,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS authenticated_update,
  has_table_privilege('authenticated', 'public.profiles', 'DELETE') AS authenticated_delete,
  has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE') AS authenticated_truncate,
  has_table_privilege('authenticated', 'public.profiles', 'REFERENCES') AS authenticated_references,
  has_table_privilege('authenticated', 'public.profiles', 'TRIGGER') AS authenticated_trigger;

SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.profiles'::regclass;

SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;
```

Required result: authenticated SELECT is true; anon SELECT and every authenticated write/administrative privilege above are false; RLS is true; `profiles_select_own_policy` remains an authenticated own-row SELECT policy.

## 5. Stage and verify the artifact

Upload `artifacts/pgs-hub-api-cpanel.zip` to a staging directory outside `<APP_ROOT>`. Verify before extraction:

```bash
sha256sum pgs-hub-api-cpanel.zip
```

Required SHA-256:

```text
a816d820a3ec9b65877c595b83c29c0cdad652a4feca9629147d20bf103b5aca
```

Extract into a new empty staging directory. Confirm these files exist:

```text
app.js
package.json
package-lock.json
DEPLOYMENT_INFO.txt
dist/main.js
```

Confirm `DEPLOYMENT_INFO.txt` contains:

```text
SOURCE_SHA=7b64b92a8eb786d9a7245e9a436ffdd8c2c53256
TARGET_NODE=22.23.0
STARTUP_FILE=app.js
ENTRYPOINT=dist/main.js
```

## 6. Install and activate without deleting the rollback copy

Enter the Node virtual environment command supplied by **Setup Node.js App**, then run in the staged release:

```bash
node --version
npm ci --omit=dev --ignore-scripts
```

Node must report `v22.23.0`. Confirm the required production environment variable names in cPanel without revealing values:

```text
APP_ENV
PORT
WEB_URL
DATABASE_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
JWT_SECRET
INITIAL_ADMIN_EMAIL
THROTTLE_TTL
THROTTLE_LIMIT
TRUST_PROXY
```

Only after the database verification, artifact SHA, dependency install, environment-name check, and rollback copy all pass, place the staged release at the exact `<APP_ROOT>` resolved in step 2. Preserve environment files and cPanel-managed configuration. Then restart the application once through **Setup Node.js App**.

## 7. Inspect startup and run production smoke tests

Inspect Passenger/application stderr immediately. Stop and roll back on a startup exception, environment-validation failure, database permission error, or repeated worker restart.

Run:

```bash
curl -i https://apihub.pgsagency.vn/api/v1/health
curl -i https://apihub.pgsagency.vn/api/v1/auth/me
curl -i -H "Origin: https://hub.pgsagency.vn" -H "X-Request-Id: profiles-repair-production" https://apihub.pgsagency.vn/api/v1/health
curl -i -H "Origin: https://evil.example.com" https://apihub.pgsagency.vn/api/v1/health
```

Required results:

- health: HTTP 200 with `status: ok` and `service: pgs-hub-api`;
- auth without token: HTTP 401 with code `UNAUTHORIZED`;
- trusted origin: HTTP 200, allowed origin header, and echoed request ID;
- untrusted origin: HTTP 403 with code `CORS_ORIGIN_DENIED`, never 500;
- no HTTP 503 and no `permission denied for table profiles` in stderr.

Using an authorized test account without printing its token, call `/api/v1/auth/me`. Required result: HTTP 200. Then verify User A can read profile A, cannot read profile B, and anonymous profile access is denied.

## 8. Release identity and rollback

Record:

- `node --version`;
- deployed `DEPLOYMENT_INFO.txt` source SHA;
- uploaded artifact SHA-256;
- migration version and privilege/RLS query results;
- Passenger restart timestamp and relevant sanitized log lines;
- health/auth/CORS/authenticated smoke results.

If any post-restart gate fails:

1. stop the new application worker;
2. restore the preserved application copy to the exact `<APP_ROOT>`;
3. restore the prior cPanel startup/root configuration if it changed;
4. install the prior locked production dependencies if required;
5. restart Passenger once;
6. repeat health and unauthenticated auth checks;
7. retain both the failed release and its logs for diagnosis.

The profiles migration is additive and required by the existing user-scoped AuthGuard. Do not revoke its SELECT grant during an application rollback unless a separate security review proves that change safe.

Do not promote or redeploy the frontend until backend health, authentication, CORS, release identity, database verification, and authorized UAT all pass.
