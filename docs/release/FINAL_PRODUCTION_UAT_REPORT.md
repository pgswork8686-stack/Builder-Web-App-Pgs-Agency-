# Final Production UAT Report — 2026-08-27

**Release under test:** `2964f8054113ec38ee5ce4d1f978037592c56c9b` / `v1.0.0-production`
**Execution timestamp:** 2026-08-27T09:39:21+07:00
**Result:** **NOT VERIFIED — GO-LIVE BLOCKED**

## Profiles permission repair update — 2026-08-28T10:27:44+07:00

This update supersedes older public API health results below.

| Area                                    | Result       | Evidence                                                                                                             |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Local API unit                          | PASS         | 615/615.                                                                                                             |
| Local API E2E                           | PASS         | 140/140, including `/auth/me` 401 without a token and 200 after AuthGuard resolves the own profile.                  |
| Local web                               | PASS         | 80/80.                                                                                                               |
| Static profiles migration chain         | PASS         | All 65 migrations match chronological filesystem order; profiles GRANT/RLS invariants pass.                          |
| Local profiles GRANT+RLS runtime        | NOT VERIFIED | Docker unavailable; local PostgreSQL connection refused.                                                             |
| Node 22.23.0 artifact                   | PASS         | Source `7b64b92`; SHA-256 `a816d820a3ec9b65877c595b83c29c0cdad652a4feca9629147d20bf103b5aca`; complete smoke passes. |
| Production frontend public pages        | PASS         | Home and login return HTTP 200 from Vercel.                                                                          |
| Production health                       | FAIL         | LiteSpeed HTML HTTP 503.                                                                                             |
| Production unauthenticated auth         | FAIL         | LiteSpeed HTML HTTP 503, not 401 `UNAUTHORIZED`.                                                                     |
| Production trusted / untrusted CORS     | FAIL         | Both return LiteSpeed HTML HTTP 503; no application CORS decision is observable.                                     |
| Production authenticated auth           | NOT VERIFIED | Backend is unavailable and no authorized test account was supplied.                                                  |
| Admin / Manager / Employee / Client UAT | NOT VERIFIED | No safe production test accounts or fixtures.                                                                        |
| Database / backup / deployment identity | NOT VERIFIED | No Supabase production, cPanel, backup-provider, or Vercel deployment-metadata access.                               |

Required next actions are to apply the migration through the approved production database process, preserve the current cPanel deployment, upload the verified artifact only after confirming Node 22.23.0 and the application root, restart Passenger, inspect the real `stderr.log`, and repeat health/auth/CORS/authenticated smoke tests before any persona UAT.

**Final UAT status: UAT NOT VERIFIED. GO-LIVE BLOCKED.**

## Continuation update — 2026-08-27T10:20:37+07:00

PR [#14](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/pull/14) passed its Quality gates, API production container, cPanel Node 22 artifact, and Vercel Preview checks. This validates the release branch (`b9c6e06`) but does not change production: `main` remains `444d7a8`, the preview is Vercel-SSO-protected, and no cPanel deployment occurred. A repeat public smoke check still observed HTTP 500 for the untrusted CORS origin, so the UAT conclusion remains blocked.

## Executed checks

| Area                                             | Result                 | Evidence                                                                           |
| ------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| API unit and integration behavior                | PASS                   | 615 API unit tests and 138 API E2E tests passed.                                   |
| Frontend behavior                                | PASS (local automated) | 80 web tests passed; production-configured Next.js build passed.                   |
| Client tenant isolation                          | PASS (automated)       | Phase 8 client-portal E2E suite is included in the 138 passing API E2E tests.      |
| RBAC/scope                                       | PASS (automated)       | Authorization/scope unit and E2E coverage passed.                                  |
| Project/task/workflow/approval/GPS/notifications | PASS (automated)       | Relevant API E2E suites passed.                                                    |
| Public frontend unauthenticated smoke            | PASS                   | Homepage and login page load in browser without console errors.                    |
| Public API health/auth smoke                     | PASS                   | Health is 200; unauthenticated auth is 401 with `UNAUTHORIZED`.                    |
| Public API invalid-origin CORS                   | FAIL                   | Production returns HTTP 500, while the verified release artifact returns HTTP 403. |

## Not executed and why

The following are **not verified**, not PASS:

- Real Admin, Manager/Team Leader, Employee, and Client login/session/logout flows: no safe test-account credentials were available. No production business action was attempted.
- Google login and session persistence: would require an authenticated test account.
- Live project → task → Kanban → Calendar → approval → notification workflow: requires safe production test data and authenticated personas.
- GPS inside/outside geofence: requires a consented device location and safe test account.
- Cross-client direct API/UI access attempts: requires two authorized client test accounts and known safe fixture records.
- Live database migration/RLS/data-integrity checks: Docker Desktop could not start its daemon for a disposable local Supabase database, and no production database access was used.
- Backup/restore, monitoring, Vercel deployment SHA, and cPanel/Passenger runtime: no corresponding deployment-provider access was available.

## Blocking defects and manual actions

1. **Backend deployment drift:** upload the verified artifact with SHA-256 `fa6cb1d2c67de1f2fa8a9cc926cae4efd4f0ee3083e062d21efc96cb55c53f19` only after preserving the existing cPanel artifact and confirming Node 22.23.0, `app.js`, and environment validation. Restart Passenger, then repeat production smoke tests. The invalid-origin request must return 403, not 500.
2. **Database validation:** make Docker Desktop available or provide an isolated disposable Supabase/Postgres environment. Run the repository migration verifiers only with their explicit local-disposable confirmation; do not run them against production.
3. **Frontend deployment verification:** access Vercel deployment details and confirm the production deployment contains the final release commit/equivalent merge commit and the production public API URL.
4. **Real UAT:** provide or nominate non-production-impacting Admin, Manager, Employee, Client A, and Client B accounts and fixture records, then execute the persona matrix without deleting or backfilling business data.

## Final UAT conclusion

Automated local coverage is strong, but the production backend’s invalid-origin response and the unavailable deployment/database/persona evidence prevent a production acceptance conclusion. **GO-LIVE BLOCKED.**
