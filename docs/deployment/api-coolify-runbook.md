# PGS Hub API Coolify runbook

This is a future deployment runbook. It does not authorize a deployment, DNS change, migration, or production data write. Deploy the API as a long-running NestJS process because its Socket.IO connections are stateful and long-lived.

## A. VPS baseline

- Ubuntu 24.04 LTS
- 2 vCPU
- 4 GB RAM
- 40–80 GB SSD
- Public IPv4
- Preferred region: Singapore or another nearby Southeast Asia region

Keep the OS patched, use SSH keys, disable password SSH where practical, and expose only the ports needed for SSH and the Coolify HTTPS proxy. Do not expose application port 3001 publicly.

## B. DNS

After the owner finalizes the company domain, create this record:

```text
Type: A
Name: api.<company-domain>
Value: VPS_PUBLIC_IP
```

Wait for DNS resolution before requesting TLS. Do not hardcode a domain before approval.

## C. Coolify application

Use these values:

```text
Source: GitHub repository
Repository: pgswork8686-stack/Builder-Web-App-Pgs-Agency-
Branch: main
Build type: Dockerfile
Dockerfile location: apps/api/Dockerfile
Build context: repository root
Container port: 3001
Public access: HTTPS only
Persistent volume: none
```

Deploy an exact reviewed main Git SHA. The API process is `node dist/main.js`; do not override it with a development or serverless command.

## D. Environment variables

Configure these names in the Coolify API application. Obtain values through the approved secret channel; do not copy them into source, GitHub Actions, build arguments, or documentation.

```text
APP_ENV
PORT
WEB_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY     SECRET
INITIAL_ADMIN_EMAIL
THROTTLE_TTL
THROTTLE_LIMIT
TRUST_PROXY
CALENDARIFIC_API_KEY   OPTIONAL
```

Required deployment settings include `APP_ENV=production`, `PORT=3001`, and `TRUST_PROXY=true`. `WEB_URL` must be the exact HTTPS web origin with no path. Production startup fails if required values are absent or invalid. Do not use local `.env` files in production.

## E. HTTPS

Attach `api.<company-domain>` to the Coolify application, enable the Coolify reverse proxy and automatic Let's Encrypt certificate, and redirect HTTP to HTTPS. Route public traffic through the proxy only; do not publish port 3001 on the VPS firewall.

## F. Health check

Configure:

```text
Path: /api/v1/health
Expected HTTP status: 200
```

Expected body shape:

```json
{
  "status": "ok",
  "service": "pgs-hub-api",
  "timestamp": "<ISO-8601 timestamp>"
}
```

This is liveness only. Monitor Supabase dependency readiness separately; do not make container restarts depend on public Internet availability.

## G. REST, CORS, auth, storage, and WebSocket smoke

Use test records approved for production smoke testing; do not reuse local placeholders.

1. Request `GET https://api.<company-domain>/api/v1/health` and verify HTTP 200.
2. From the deployed web origin, make an API request and verify the exact `WEB_URL` origin is allowed. Verify an unrelated origin is rejected.
3. Sign in as an approved smoke user and call one permitted read-only REST endpoint. Confirm `X-Request-Id` is returned.
4. Perform one approved Storage read/upload smoke according to the production checklist, then remove only the smoke object if removal was pre-approved.
5. In browser developer tools, connect Socket.IO to `https://api.<company-domain>/chat` using the signed-in user's Supabase access token in `auth.token`. Do not place the token in the URL or logs.
6. Emit `chat.join` with an authorized conversation UUID and verify `{ ok: true }`. Verify an unauthorized conversation is denied.
7. Send a smoke message through the normal REST/UI flow and verify the other authorized client receives the chat event.
8. Disconnect the network or socket, restore it, let the Socket.IO client reconnect, re-authenticate, rejoin the conversation, and verify another message is received.
9. Disconnect both clients cleanly and inspect logs for errors or token leakage.

The reverse proxy must support WebSocket upgrade headers and long-lived connections. Production origins remain exact; never replace `WEB_URL` with `*`.

## H. Rollback

1. Identify the previous known-good application Git SHA/image from Coolify deployment history.
2. Redeploy that exact application revision.
3. Verify health, authentication, REST, CORS, and WebSocket behavior.
4. Record the failed and restored SHAs and retain relevant logs.

Application rollback does not automatically roll production database migrations backward. The production database is already migrated. Use a separately reviewed forward-fix database procedure if schema remediation is ever required; never couple ordinary application rollback to destructive migration rollback.

## I. Logs and health

Inspect the Coolify application logs, underlying container stdout/stderr logs, deployment events, and container health status. Production request logs include timestamp, level, service, environment, request ID, method, path, status, and duration. They intentionally exclude authorization headers, cookies, bodies, passwords, and tokens.

## J. Secrets rotation

Store and rotate secrets in the Coolify application environment, not GitHub or source. After rotating a Supabase secret, restart/redeploy the API, verify health and authentication, and inspect logs for failures. Never paste secret values into tickets, chat, screenshots, or command history.
