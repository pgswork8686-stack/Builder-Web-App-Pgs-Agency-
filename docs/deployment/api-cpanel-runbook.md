# PGS Hub API cPanel/Passenger runbook

This is a future deployment procedure, not deployment authorization. Do not access cPanel, upload, change DNS/SSL/Cloudflare, use production secrets, or access production Supabase during packaging review.

## A. Build

From the reviewed repository SHA:

```text
pnpm install --frozen-lockfile
pnpm build:cpanel-api
```

Record the reported path, byte size, and SHA-256 for `artifacts/pgs-hub-api-cpanel.zip`. The builder compiles NestJS, validates the pinned runtime manifest/lock, creates a minimal wrapper, rejects forbidden secret/backup content, and writes a deterministic ZIP. Generated artifacts are Git-ignored.

## B. cPanel settings

Use the provider's equivalent fields:

```text
Node.js version: 22.23.0
Application mode: production
Application root: public_html/apihub
Application URL: apihub.pgsagency.vn
Application startup file: app.js
```

Do not select Node 20; Supabase JS requires Node 22 or newer. Do not select Node 24 without a separately reviewed need.

## C. Upload

During the authorized deployment window, first back up the current simple test application directory outside the served path with access restricted. Upload the reviewed ZIP into `/home/<cpanel-user>/public_html/apihub`, not the `public_html` root. Verify its SHA-256 before extraction.

## D. Extract

After extraction, the application root must contain only the package contents at its top level:

```text
public_html/apihub/
├── app.js
├── package.json
├── package-lock.json
├── DEPLOYMENT_INFO.txt
└── dist/
    └── main.js
```

No `.env`, source, tests, Git data, web frontend, migrations, backups, or local `node_modules` belongs in the upload.

## E. Dependencies

Use the selected Node 22.23.0 application's npm environment from cPanel/CloudLinux. In the application root run:

```text
npm ci --omit=dev --ignore-scripts
```

If the provider exposes only a **Run NPM Install** control, confirm with the provider that it uses the uploaded `package-lock.json` and installs production dependencies in the application's managed virtual environment. Do not install pnpm or clone the monorepo on hosting. Do not upload Windows `node_modules`.

## F. Environment

Enter values only in **Setup Node.js App → Environment Variables** (wording may vary). Required names:

```text
APP_ENV
PORT
WEB_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
INITIAL_ADMIN_EMAIL
THROTTLE_TTL
THROTTLE_LIMIT
TRUST_PROXY
CALENDARIFIC_API_KEY
```

Production intent: `APP_ENV=production`, exact `WEB_URL=https://hub.pgsagency.vn`, hosting-assigned `PORT`, `THROTTLE_TTL=60000`, `THROTTLE_LIMIT=120`, and `TRUST_PROXY=true`; `CALENDARIFIC_API_KEY` is optional. `SUPABASE_SECRET_KEY` is a server secret: never put it in source, ZIP, `app.js`, GitHub, frontend, `NEXT_PUBLIC_*`, screenshots, or documentation.

## G. Restart

Use **cPanel → Node.js Application → Restart Application**. Do not kill arbitrary shared-hosting processes. A Passenger `tmp/restart.txt` marker is a secondary fallback only if this provider explicitly documents/supports it; prefer the UI.

## H. Health

Request:

```text
https://apihub.pgsagency.vn/api/v1/health
```

Require HTTP 200, `status: ok`, `service: pgs-hub-api`, an ISO timestamp, and a preserved caller `X-Request-Id`. This endpoint is liveness, not Supabase readiness.

## I. Auth and API smoke

From `https://hub.pgsagency.vn`, verify exact CORS allows the web origin and rejects an unrelated origin. Sign in with an approved smoke user and run read-only calls first: auth/profile, Supabase-backed read, attendance read, and project read. Run Storage only under an approved smoke/cleanup plan. Do not begin with payroll, finance, migrations, or business writes.

## J. WebSocket

Run every step in [cpanel-websocket-test.md](cpanel-websocket-test.md). Do not accept the host for full PGS Hub until handshake, token auth, room authorization, realtime receipt, disconnect/reconnect, re-authentication, and rejoin all pass.

## K. Logs

Use the Node.js Application UI's application/error log link or the provider-confirmed Passenger log location. Inspect startup validation failures, npm install output, runtime stderr/stdout, proxy upgrade errors, and restarts. Do not create token/access logs under `public_html`, and redact secrets before sharing diagnostics.

## L. Rollback

Stop/restart through the cPanel UI, restore the backed-up known-good test/application files, reinstall their locked dependencies if required, and restart. Verify the prior response. Application rollback never authorizes production database rollback, reverse migrations, or data deletion.
