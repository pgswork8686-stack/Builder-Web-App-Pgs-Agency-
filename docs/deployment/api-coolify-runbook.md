# PGS Hub API Coolify runbook

This is a future deployment runbook. It does not authorize deployment, DNS/firewall changes, migration, or production data writes. The preferred production path is:

```text
Internet -> Cloudflare TLS/DDoS/WAF/rate limit/WebSocket proxy
         -> Cloudflare Tunnel -> VPS-private Coolify/API -> NestJS :3001
```

Deploy the API as a long-running NestJS service because Socket.IO connections are stateful and long-lived. See the [Tunnel runbook](cloudflare-tunnel-runbook.md), [DNS plan](cloudflare-dns-plan.md), and [edge security policy](cloudflare-security-policy.md).

## A. VPS baseline

- Ubuntu 24.04 LTS; 2 vCPU; 4 GB RAM; 40–80 GB SSD.
- Keep the OS patched, use SSH keys, and disable password SSH where practical.
- Never expose application port 3001 publicly. The Tunnel connector initiates outbound traffic; public API ports 80/443 are not required by this route.
- Restrict Coolify management separately according to the owner-approved administration design.

## B. DNS and exposure

Do not create an API A/AAAA record pointing at the VPS. Create `api.<company-domain>` as a Cloudflare Tunnel public-hostname route in the separately approved infrastructure phase. Cloudflare remains authoritative; the Vercel web hostname stays DNS Only. Do not hardcode a company domain before approval.

The API service must be reachable only from the chosen Tunnel connector topology:

- Recommended host connector: publish the API to a verified loopback-only host port and target `http://127.0.0.1:<local-port>`.
- Alternative connector container: attach it to the private Docker network and target `http://<api-service-name>:3001`.

Do not assume `localhost` across containers and do not attach the API to an unnecessary public proxy/network.

## C. Coolify application

```text
Source: GitHub repository
Repository: pgswork8686-stack/Builder-Web-App-Pgs-Agency-
Branch/revision: exact reviewed main SHA
Build type: Dockerfile
Dockerfile location: apps/api/Dockerfile
Build context: repository root
Container port: 3001
Public access: private/Tunnel only
Persistent volume: none
Health path: /api/v1/health
```

The process is `node dist/main.js`; do not override it with a development or serverless command. Verify the effective Docker port binding/network before continuing.

## D. Environment variables

Obtain values through the approved secret channel and store them only in Coolify's runtime secret environment—not source, GitHub Actions, build arguments, or docs.

```text
APP_ENV
PORT
WEB_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY      SECRET
INITIAL_ADMIN_EMAIL
THROTTLE_TTL
THROTTLE_LIMIT
TRUST_PROXY
CALENDARIFIC_API_KEY    OPTIONAL
```

Set `APP_ENV=production`, `PORT=3001`, `TRUST_PROXY=true`, and exact HTTPS `WEB_URL` with no path. Startup fails on missing/invalid required values. Do not use a production `.env` file.

Express trusts one proxy hop, not arbitrary chains. The canonical resolver accepts a valid single `CF-Connecting-IP` only from an immediate loopback/private peer, otherwise it uses a normalized safe fallback. This depends on the origin being closed; do not put a public proxy in front of the private application peer that forwards attacker-controlled Cloudflare headers.

## E. TLS

Public TLS terminates at Cloudflare. Private HTTP from `cloudflared` to loopback/the isolated Docker network is acceptable. If local-origin HTTPS is chosen, verification stays enabled; `noTLSVerify=true` is not a production configuration.

## F. Health and smoke

Expected `GET /api/v1/health` status is 200 with body shape:

```json
{
  "status": "ok",
  "service": "pgs-hub-api",
  "timestamp": "<ISO-8601 timestamp>"
}
```

This is liveness only; monitor Supabase readiness separately. Through the Cloudflare hostname:

1. Verify health and `X-Request-Id`.
2. Verify exact `WEB_URL` CORS allows the deployed web and rejects an unrelated origin.
3. Use an approved smoke user for one read-only authenticated REST request.
4. Perform any Storage write smoke only with separate approval and a named cleanup plan.
5. Connect Socket.IO `/chat` using the Supabase access token in `auth.token`; verify auth, authorized `chat.join`, send/receive, disconnect, reconnect, re-authenticate, rejoin, and receive again.
6. Check `/notifications` and `/project-workspace` connections where applicable.
7. Inspect logs for errors or token/header leakage.
8. From an external network, prove the VPS IP cannot serve the API on 3001 or any unapproved direct 80/443 route.

Cloudflare must pass WebSocket upgrades. Production origin is exact; never set `WEB_URL=*`.

## G. Direct HTTPS emergency fallback

A direct Coolify HTTPS proxy is not the normal architecture. Preserve it only as a written emergency option: explicit owner authorization, valid certificate, strict firewall/allowlisting where feasible, application auth/CORS retained, no public 3001, monitoring enabled, and a short time-bound plan to restore Tunnel and close origin access. Never enable it automatically after a Tunnel failure.

## H. Logs, secrets, and rollback

Production request logs contain bounded normalized client IP, request ID, method, path, status, duration, service, and environment. They exclude raw forwarding headers, authorization, cookies, bodies, passwords, and tokens.

Rotate secrets in the Coolify runtime environment. Never paste values into tickets, chat, screenshots, or command history.

For an API failure, redeploy the previous known-good application SHA/image and re-run health/auth/REST/CORS/WebSocket checks. Roll back WAF, rate rules, Tunnel route, and `cloudflared` independently as described in the Tunnel runbook. Never couple an edge/network rollback to a destructive database rollback.
