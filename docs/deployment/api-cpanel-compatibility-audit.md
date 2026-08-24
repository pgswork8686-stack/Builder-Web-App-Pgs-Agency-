# PGS Hub API cPanel/Passenger compatibility audit

Audit base: `45c5a854928941ac424b86844e554c5390af6290`. This profile packages the existing NestJS application; it does not deploy or change production infrastructure.

## Build and runtime findings

- `pnpm --filter api build` compiles the API to `apps/api/dist`. The runtime entrypoint is `apps/api/dist/main.js`.
- The output is CommonJS-compatible (`require`/`exports`) because the API package has no ESM `type`; the cPanel `app.js` wrapper can safely do only `require('./dist/main.js')`.
- Compiled output has no unresolved PGS Hub workspace-package imports. Runtime needs only the API's direct npm dependencies and their transitives; it does not need the web app, source, tests, Supabase migrations, or monorepo packages.
- The deployment manifest pins exact resolved production dependency versions and has an npm lockfile. The operator does not need pnpm or the monorepo: run `npm ci --omit=dev --ignore-scripts` in the extracted application root.
- Node `22.23.0` is explicitly tested. `@supabase/supabase-js@2.112.2` declares Node `>=22`; NestJS 11, Express 5, Socket.IO 4, `pg`, Zod, Helmet, class-validator, and class-transformer load and run under the selected version.

## Port and process model

The existing canonical flow is already compatible:

```text
process.env.PORT -> Zod validate/convert -> ConfigService.port -> app.listen(port)
```

The API does not hardcode port 3001. That value remains a default/local/Docker convention. `app.listen(port)` does not impose a loopback-only host, so no cPanel-only source change is needed. Passenger/cPanel must supply a valid TCP `PORT` through its managed application environment; do not invent or hardcode one in `app.js`.

Nest shutdown hooks already handle `SIGTERM`/`SIGINT`. Logs remain on stdout/stderr for the hosting control panel or provider-configured Passenger log, never a file under `public_html`.

## Security behavior retained

- `APP_ENV=production` CORS permits only exact `WEB_URL`; localhost is not added and wildcard is not used.
- Existing Zod validation remains the only environment validator and reports field names/messages without supplied values.
- `TRUST_PROXY=true` keeps Express at one trusted hop (`trust proxy = 1`) for the direct cPanel reverse-proxy topology. Do not broaden it to arbitrary chains.
- A later Cloudflare-to-cPanel path can add another forwarding layer and requires an independently reviewed client-IP/proxy design plus real header tests. This branch does not include PR #11.
- Socket.IO namespaces and Supabase token authentication are unchanged. The compiled application starts all gateways, but shared-hosting WebSocket upgrade and long-lived-connection support cannot be proven locally.

## Passenger compatibility boundary

cPanel/CloudLinux provider field names vary, but the verified hosting contract is Node 22.23.0, production mode, application root `public_html/apihub`, URL `apihub.pgsagency.vn`, and startup file `app.js`. The wrapper starts the same NestJS process and contains no duplicate routes, CORS, Helmet, Supabase, auth, or business logic.

The provider's real reverse proxy must pass HTTP upgrades and sustain WebSockets. Deployment day therefore has an explicit REST/auth/Socket.IO decision gate in [cpanel-websocket-test.md](cpanel-websocket-test.md). General references: [cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/) and [Passenger application restart](https://www.phusionpassenger.com/docs/advanced_guides/developing_with_passenger/node/restart_app.html).
