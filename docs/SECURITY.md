# PGS Hub Security

## Authority model

The browser is not trusted for business authority. NestJS derives authenticated user ID, role, account status, profile ownership, project membership, client-company membership, sender ID, and approval/payment actors from the Supabase token and database state.

## RBAC

RBAC is enforced in four places:

1. UI navigation and route guards hide unavailable workflows.
2. Nest controllers require authentication and role permissions.
3. Services re-check ownership, membership, and tenant boundaries.
4. PostgreSQL uses RLS, constraints, grants, and secure helper functions as defense in depth.

## Supabase keys

- Frontend: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- API: `SUPABASE_SECRET_KEY` stays server-only.
- Never add `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` or any service-role key to web code.

## RLS and grants

Nest-only business tables enable RLS and revoke table access from `PUBLIC`, `anon`, and `authenticated`. Browser data access is intentionally denied for sensitive tables. Service access goes through the API using `service_role`.

## RPC security

New database functions use:

- `SECURITY INVOKER`
- `SET search_path = public, pg_temp`
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated`
- `GRANT EXECUTE ... TO service_role`

Legacy SECURITY DEFINER helper exposure is locked down by the Phase 8 hardening migration.

## Storage

Internal files and attendance evidence use private storage patterns. The server validates upload sessions, expected object paths, MIME type, size, and resource authorization before accepting a file reference.

## Socket security

Socket.IO gateways authenticate the access token and authorize every room join. Project/task/chat/notification rooms are server-controlled; client-provided IDs are treated only as lookup inputs, not as authorization.

## Migration rules

- Do not edit applied historical migrations.
- Fix applied schema with new additive migrations.
- Keep schema changes committed under `supabase/migrations`.
- Run Supabase advisors after database security or performance changes when project access is available.

## Static security checks

Run before release:

```bash
rg "\.from\(" apps/web
rg "service_role" apps/web
rg "SUPABASE_SERVICE_ROLE" apps/web
rg "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"
rg "dangerouslySetInnerHTML" apps
rg "eval\(" apps
rg "new Function" apps
rg "window\.confirm" apps/web
rg "window\.alert" apps/web
```
