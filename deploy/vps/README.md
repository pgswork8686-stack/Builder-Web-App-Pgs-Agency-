# PGS Agency Hub — existing project VPS deployment

This directory deploys the **existing** PGS Agency Hub monorepo. It is NOT a new
application or a new database. It keeps the current five roles:
`admin`, `team_leader`, `employee`, `accountant`, and `client`.

Services: Next.js web (internal port 3000), NestJS API + Socket.IO (internal
port 3001), Caddy HTTPS reverse proxy (public ports 80/443). The existing
Supabase Auth, PostgreSQL, and Storage remain in use. No schema migrations
are run automatically by this Compose stack.

## Before deployment
1. Clone the existing repository on the VPS, checkout the **reviewed branch
   or commit**, and install Docker Engine + Docker Compose plugin.
2. Point `WEB_DOMAIN` and `API_DOMAIN` DNS to the VPS. Ensure neither domain
   is already handled by a different web server on ports 80/443.
3. Copy `deploy/vps/.env.example` to `deploy/vps/.env`. Fill the existing
   Supabase credentials and database connection privately. Do not paste them
   into tickets or GitHub. Use `chmod 600 deploy/vps/.env`.
4. Set the production Supabase Auth site URL and callback allowlist to include
   `https://WEB_DOMAIN` and `https://WEB_DOMAIN/auth/callback`.
5. Back up the current database and verify a restore path before any
   production change. No migrations should be applied without review.

## Check and start

```bash
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml config --quiet
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml up -d --build
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml ps
docker compose --env-file deploy/vps/.env -f deploy/vps/compose.yaml logs --tail=100 api web proxy
```

Web: `https://WEB_DOMAIN/auth/login`
API liveness: `https://API_DOMAIN/api/v1/health`

Verify as each of the five roles, especially customer-to-customer isolation,
internal-only notes, approval/feedback history, attendance, finance visibility
and WebSocket realtime messaging. Run repository lint, typecheck, unit/e2e tests
and build before production cutover. Health success alone does not establish
database connectivity or correct business permissions.

## Security notes
- API and web are only exposed to the internal Docker network; only the
  HTTPS proxy binds host ports.
- `SUPABASE_SECRET_KEY`, `JWT_SECRET`, and `DATABASE_URL` are API-only
  environment values. No secret is passed as a web build argument.
- The public `NEXT_PUBLIC_*` values are baked into the web image at build time.
  Rebuild the web image after changing domain or Supabase public settings.
- The API is long-running for Socket.IO; Caddy forwards WebSocket upgrades.
- This stack does **not** include an automatic database backup or offsite
  storage job. Arrange verified external backups before production.
- Do not run this stack on a server already using ports 80/443 without
  adapting the proxy routes. Do not replace an existing live deployment
  until rollback and smoke tests have been completed.

## Rollback
Deploy the previous known-good Git commit/image for app rollback. Database
migrations, if any, require a separate reviewed recovery/forward-fix plan.
