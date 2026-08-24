# API deployment packaging audit

Audit baseline: `d33446a7c918d0ddbd7a598554b54afc99cd2ecd`.

## Existing behavior preserved

- The repository is a pnpm 11.20.0 monorepo and CI uses Node.js 22.
- The NestJS API builds to `apps/api/dist` and starts with `node dist/main`.
- The API listens on configurable `PORT` (default 3001) with the global prefix `/api/v1`.
- `GET /api/v1/health` returns a lightweight process health response.
- Environment configuration uses the existing Zod validator. With `APP_ENV=production`, local `.env` files are ignored.
- Production HTTP CORS and all three Socket.IO namespaces use the exact `WEB_URL` origin and credentials. Socket connections require a Supabase access token and an active profile; room joins are authorization checked.
- `TRUST_PROXY` is supported and enables one trusted reverse-proxy hop.
- Request IDs were already generated and returned as `X-Request-Id`; HTTP exception responses already include them.
- Helmet, request body limits, DTO validation, global throttling, and stdout/stderr Nest logging already existed.
- A root multi-target Dockerfile existed for API and web, but it copied the full build tree into a root runtime. It is not the production API packaging path described by this package.

## Packaging decisions

- `apps/api/Dockerfile` is the production API image. Its build context is the repository root.
- The runtime contains only the deployed API package and production dependencies, runs as the built-in non-root `node` user, and executes `node dist/main.js`.
- Docker liveness checks only the local lightweight health route. A Supabase-dependent readiness route is intentionally deferred to external monitoring so a transient dependency outage does not trigger an API restart loop.
- Nest shutdown hooks handle `SIGTERM` and `SIGINT`; the normal Nest close path shuts down the HTTP server and Socket.IO adapter.
- Production request logs are structured safe metadata. Headers, cookies, bodies, tokens, and response bodies are not logged.
- Caller request IDs are accepted only when they contain a small safe character set and are at most 128 characters; otherwise the API generates a UUID.
- Coolify must set `TRUST_PROXY=true`, representing the existing explicit one-hop proxy model.

## Deployment-day follow-up

Dependency readiness should be monitored separately from container liveness. If operational evidence later requires `/api/v1/health/ready`, add bounded dependency checks with timeouts and ensure Coolify does not use that route as its restart healthcheck.
