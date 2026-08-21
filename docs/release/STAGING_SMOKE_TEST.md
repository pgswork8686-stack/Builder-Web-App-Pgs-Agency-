# PGS HUB — Disposable Staging Smoke Test

## Safety boundary

This smoke test is for the **known local Supabase PostgreSQL environment only**. Do not set `DATABASE_URL` to a hosted database or another local database. The migration verifier destroys and recreates the `public` schema by design; it accepts only a loopback host on port `54322`, database `postgres`, and explicit operator acknowledgement before connecting.

Hosted or production Supabase must not be used for this runbook.

## Preconditions

1. Source is on the approved `main` SHA after PR #7 merge.
2. Docker Desktop is running and the local Supabase stack is healthy.
3. `DATABASE_URL` targets the local Supabase database on port `54322` named `postgres`; the operator has independently confirmed it is disposable.
4. No inherited hosted `SUPABASE_*`, `WEB_URL`, `NEXT_PUBLIC_*`, or `DATABASE_URL` values remain in the shell.

## Commands

```powershell
$env:CI = 'true'
.\node_modules\.bin\supabase.cmd start
.\node_modules\.bin\supabase.cmd db reset

$env:DATABASE_URL = 'postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres'
$env:PGS_RELEASE_DB_DISPOSABLE = 'confirmed'
pnpm test:release-migrations
node scripts/seed-local-uat.mjs
```

The verifier applies the explicit 54-migration manifest, excluding the legacy monolithic Phase 10 SQL file. It checks tables, RLS, sequences, business constraints, smoke flows, direct browser-role table access, and browser-role execution of public `SECURITY DEFINER` functions.

## Application smoke

Start API and web in separate terminals with explicit local `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values from `supabase status -o env`. In the terminal that runs UAT, set the same three `NEXT_PUBLIC_*` variables and `PGS_RELEASE_DB_DISPOSABLE=confirmed`. Then run:

```powershell
node scripts/run-full-local-uat.mjs
node scripts/capture-screenshots.mjs
```

The UAT seed uses the deterministic accounts `admin@test.local`, `leader@test.local`, `employee@test.local`, `accountant@test.local`, and `client@test.local`. Screenshot capture blocks non-loopback HTTP(S)/WebSocket requests before credential submission and fails on an HTTP error, redirect, off-origin page, console error, page error, or failed local network request.

## Evidence rule

Record exact command output, SHA, timestamps, and screenshots in [FINAL_ACCEPTANCE_REPORT.md](FINAL_ACCEPTANCE_REPORT.md). A historical CI claim or a prior source SHA is not a substitute for this run.
