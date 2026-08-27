# Final Deployment Evidence — 2026-08-27

**Evidence timestamp:** 2026-08-27T09:39:21+07:00
**Release source:** `2964f8054113ec38ee5ce4d1f978037592c56c9b` (`v1.0.0-production`)
**Branch under validation:** `codex/production-hardening-2026-08-26`
**Deployment action performed:** none — deployment is blocked by the evidence below.

## Continuation update — 2026-08-27T10:20:37+07:00

- Runtime release branch head: `b9c6e060e7ca68edf77d06769b31f557aa3804f3`.
- Production tag remains unchanged: `v1.0.0-production` dereferences to `2964f8054113ec38ee5ce4d1f978037592c56c9b`.
- Verified current-branch cPanel artifact: `b2656a8f24932164b59552acfc33af3ab6d9bda463909233d7de5a7587d10cab` under Node.js 22.23.0. Its `DEPLOYMENT_INFO.txt` records `SOURCE_SHA=b9c6e06`.
- PR [#14](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/pull/14) is open from the release branch to `main` (`444d7a8`). GitHub Quality gates, API production container, cPanel Node 22 artifact, and Vercel Preview checks all passed. The Vercel deployment is Preview only and protected by Vercel SSO; it is not production evidence.
- A repeated public smoke request at 2026-08-27T03:20:37Z confirmed trusted CORS remains 200 and unauthenticated auth remains 401, but untrusted `https://evil.example.com` still receives HTTP 500. No cPanel deployment access is available in this workspace, so the verified artifact has not been uploaded or restarted.

## Local release evidence

| Gate                           | Actual result                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Frozen dependency installation | PASS — `pnpm install --frozen-lockfile` completed without lockfile changes.                                       |
| Lint                           | PASS with 267 pre-existing warnings and 0 errors after fixing release test lint defects.                          |
| Typecheck                      | PASS — all 7 workspace projects.                                                                                  |
| Formatting                     | PASS — Prettier check and `git diff --check main` pass.                                                           |
| Secret-boundary script         | PASS — `SECRET_BOUNDARIES=PASS`.                                                                                  |
| Tests                          | PASS — API unit 67 suites / 615 tests; API E2E 16 suites / 138 tests; web 14 files / 80 tests; validation 1 test. |
| Production build               | PASS under Node.js 22.23.0 — Nest build and Next.js build (86 routes).                                            |
| cPanel artifact                | PASS under Node.js 22.23.0. SHA-256: `fa6cb1d2c67de1f2fa8a9cc926cae4efd4f0ee3083e062d21efc96cb55c53f19`.          |
| Artifact verification          | PASS — startup, health, request ID, allowed/rejected CORS, SIGTERM, and all listed environment fail-fast cases.   |

The artifact was independently rebuilt from a disposable clean checkout at exactly `2964f80`; it produced the identical SHA-256. The SHA supplied in the execution brief (`d1ea8abdefca137ba2c040ca2863939f82623116f38ddf7b940e3553a31999e3`) is therefore stale evidence, not a nondeterministic build result.

## Frontend build configuration evidence

The ignored local frontend environment had a localhost API URL, so the first generic build was unsuitable as a production-configuration validation. A second Node 22.23.0 build explicitly set only these public deployment values in the process environment, without editing an environment file:

- `NEXT_PUBLIC_API_URL=https://apihub.pgsagency.vn/api/v1`
- `NEXT_PUBLIC_APP_URL=https://hub.pgsagency.vn`

That production-configured build passed. Its static client bundles include the production API URL and no `localhost:3001` endpoint. Remaining `localhost:9999` and `127.0.0.1:54321` literals occur in a Supabase library development-default chunk; they are not the configured API endpoint. A credential-pattern scan of static and server build output found no service-role key, `sb_secret_` key, Google OAuth secret, or private key material.

## Production smoke evidence

| Request / check                                                     | Actual response                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `https://hub.pgsagency.vn/`                                         | HTTP 200; browser title `PGS Hub`; no browser console errors.                                                                   |
| `https://hub.pgsagency.vn/auth/login`                               | HTTP 200; Google sign-in control rendered; no browser console errors. No login was attempted.                                   |
| `GET https://apihub.pgsagency.vn/api/v1/health` with allowed Origin | HTTP 200, `status: ok`, expected service name, echoed request ID, allowed CORS origin, CSP, HSTS, `nosniff`, and `no-referrer`. |
| `GET https://apihub.pgsagency.vn/api/v1/auth/me` without token      | HTTP 401, code `UNAUTHORIZED`; no stack trace or secret was exposed.                                                            |
| Health request with `Origin: https://attacker.example`              | **HTTP 500**, generic body, no reflected CORS origin. Expected response from the verified artifact is HTTP 403.                 |

The untrusted-origin result proves the public backend does not currently exhibit the behavior of the verified release artifact. It must be reconciled before any go-live decision.

## Deployment systems not verified

- No Vercel deployment metadata, build log, or production commit SHA was accessible from this workspace.
- No cPanel/Passenger access was available to preserve the current artifact, verify Node/runtime/environment, upload the verified ZIP, restart Passenger, or inspect logs.
- No production database or Supabase migration state was accessed or changed.
- Backup, PITR, restore, monitoring, and alert-delivery evidence were not accessible.

## Rollback

No deployment occurred in this execution, so no rollback was required. Before a future cPanel deployment, record and retain the currently deployed artifact and SHA, then restore that exact preserved artifact and restart Passenger if the post-deploy smoke gate fails. Before a future Vercel promotion, retain the prior production deployment identifier and use the provider’s rollback operation rather than rewriting `main` history.
