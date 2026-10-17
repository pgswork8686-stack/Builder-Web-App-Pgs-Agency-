# Production Status — PGS Hub

Audit date: 2026-10-16 (UTC probe times below). Scope: **unauthenticated, read-only** requests only.
No production credentials, database access, Vercel/cPanel dashboards or logs were available to this audit.

Source baseline: `a07b74e502d5ce0e0b124df7982a60a2733a15fb` (upstream `main` HEAD on 2026-10-16; commit date 2026-08-29).
Production URLs come from `docs/release/FINAL_DEPLOYMENT_EVIDENCE.md`: web `https://hub.pgsagency.vn`, API `https://apihub.pgsagency.vn/api/v1`.

## Evidence matrix

| #   | Check                                               | Request                                               | Result (UTC time)                                                                                                                                                                        | Status                    |
| --- | --------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Frontend reachable                                  | `GET https://hub.pgsagency.vn/`                       | 200, `server: Vercel`, HSTS `max-age=63072000`, `x-nextjs-prerender: 1`, `age: 1142958` (cached prerender ≈ 13.2 days old) — 01:50:37Z                                                   | VERIFIED (reachable only) |
| 2   | Frontend route `/login`                             | `GET /login`                                          | **404** — 01:50:39Z. Login lives elsewhere (route not identified in this audit); not a defect by itself                                                                                  | INFO                      |
| 3   | API health                                          | `GET /api/v1/health`                                  | 200 `{"status":"ok","service":"pgs-hub-api","timestamp":"2026-10-16T01:50:41Z"}`, `server: LiteSpeed` — 01:50:40Z                                                                        | VERIFIED                  |
| 4   | Security headers (API)                              | same                                                  | HSTS (1y, preload), CSP `default-src 'self'` + connect-src hub + Supabase project host, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` | VERIFIED                  |
| 5   | Auth enforced                                       | `GET /api/v1/projects` (no token)                     | 401 — 01:50:40Z                                                                                                                                                                          | VERIFIED                  |
| 6   | CORS allowed origin                                 | `OPTIONS /health`, `Origin: https://hub.pgsagency.vn` | 204, `access-control-allow-origin: https://hub.pgsagency.vn`, credentials true                                                                                                           | VERIFIED                  |
| 7   | CORS foreign origin                                 | `OPTIONS /health`, `Origin: https://evil.example`     | 403, no ACAO header                                                                                                                                                                      | VERIFIED                  |
| 8   | New aggregate endpoint deployed                     | `GET /api/v1/tasks` (no token)                        | **404** — the route added in this branch is not in production (expected: not deployed)                                                                                                   | VERIFIED (absence)        |
| 9   | Deployed SHA (web / API)                            | —                                                     | No version header or `/health` build field exposes a commit SHA                                                                                                                          | **NOT VERIFIED**          |
| 10  | Frontend ↔ backend connectivity with a real session | —                                                     | Requires a login                                                                                                                                                                         | **NOT VERIFIED**          |
| 11  | Supabase connectivity + applied migration versions  | —                                                     | No read-only DB access provided                                                                                                                                                          | **NOT VERIFIED**          |
| 12  | Auth redirects / Supabase Auth config               | —                                                     | Dashboard access not provided                                                                                                                                                            | **NOT VERIFIED**          |
| 13  | Error logs, deployment config                       | —                                                     | Not accessible                                                                                                                                                                           | **NOT VERIFIED**          |

An HTTP 200 on the frontend and API health does **not** prove authenticated workflows work.

## Findings

| ID  | Severity | Finding                                                                                                                                                                     | Affected                            | Remediation                                                                                          | Evidence     |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------ |
| P-1 | Medium   | No way to tell which commit is deployed (no SHA in `/health` or headers). Release reports cannot be reconciled with production.                                             | `apps/api/src/health`, Vercel build | Expose `GIT_SHA`/build time in `/health` and an `x-release` header; record SHA in each release note. | Probe #3, #9 |
| P-2 | Low      | Marketing-style static pages on the web host send `access-control-allow-origin: *` (Vercel default for static prerender). No authenticated data is served from these paths. | Vercel config                       | Optional: restrict via `vercel.json` headers.                                                        | Probe #1     |
| P-3 | Info     | Frontend root is a ~13-day-old prerender cache entry (`age`), so it does not prove a recent deploy.                                                                         | —                                   | Confirm last Vercel deployment in dashboard.                                                         | Probe #1     |
| P-4 | Info     | Production API lacks `GET /tasks` (new in this branch). The new Tasks/Kanban/Calendar pages will fail against production until the API is deployed **before** the web app.  | release order                       | Deploy API first, then web.                                                                          | Probe #8     |

## Required follow-ups (need authorization)

1. Provide read-only Supabase access (or run the SQL in `docs/release/WORKFLOW_PREFLIGHT.sql`) to compare `supabase_migrations` against `supabase/migrations/`.
2. Provide the deployed SHA for web and API.
3. Provide a staging environment with isolated test users for authenticated verification.

Overall production verification: **PARTIAL — reachability, headers, CORS and auth enforcement verified; everything authenticated or database-side NOT VERIFIED.**
