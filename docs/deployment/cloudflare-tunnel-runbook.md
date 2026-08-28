# PGS Hub Cloudflare Tunnel runbook

This is a future production procedure. Do not create a Tunnel, install `cloudflared`, change DNS/firewalls, or use credentials during packaging review.

## Target route and recommended topology

```text
Browser -> Cloudflare TLS/WAF/rate limit/WebSocket proxy
        -> outbound Cloudflare Tunnel -> VPS-local API -> NestJS :3001
```

Recommend approach A for V1 because it has the fewest moving parts.

### A — recommended: `cloudflared` on the VPS host

Run the connector as an OS service and route the public hostname to a Coolify-published port bound only to loopback, conceptually `http://127.0.0.1:<local-port>`. Before rollout, verify the actual Coolify port publication is loopback-only and reachable from the host. Never publish that port on `0.0.0.0` or the public firewall.

### B — supported: connector container on the Coolify Docker network

Attach a dedicated `cloudflared` container to the same private Docker network and target `http://<api-service-name>:3001`. `localhost` inside this container means the connector itself, not the API. Pin/review the connector image, keep credentials in the platform secret store, and verify network reachability by service name.

Do not combine both approaches for one route. A public Coolify proxy is not part of the preferred route.

## Prerequisites and secret handling

- Owner-approved Cloudflare zone, API hostname, Tunnel, and deployment window.
- Exact reviewed API SHA and green CI/container gates.
- Connector token or credentials supplied through the approved secret store, never Git, Docker build arguments, screenshots, tickets, or shell history.
- `TRUST_PROXY=true`, exact HTTPS `WEB_URL`, and all other production environment values configured in Coolify.

Cloudflare Tunnel maps a public hostname to a local service; a dashboard-managed route creates the appropriate tunnel DNS target. Do not paste credential JSON into the repository. See [Tunnel routing](https://developers.cloudflare.com/tunnel/routing/) and [locally managed configuration](https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/).

## Firewall and connectivity contract

- Port `3001`: never Internet reachable.
- Ports `80` and `443`: not required for the API origin route. Keep closed unless a separately approved Coolify-management or unrelated service requires them.
- Connector egress: allow TCP and UDP `7844`; retain normal DNS and HTTPS dependencies. QUIC uses UDP and HTTP/2 fallback uses TCP. Validate using Cloudflare's [connectivity prechecks](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/connectivity-prechecks/).
- No inbound Cloudflare IP allowlist is needed for Tunnel application traffic because the connector initiates outbound connections.

Do not change a real firewall under this packaging task.

## TLS

Public client TLS terminates at Cloudflare. Plain HTTP between `cloudflared` and the API is acceptable only over loopback or a private Docker network that cannot leave the trusted VPS.

If HTTPS is selected for the local origin, use a valid certificate and keep verification enabled. `noTLSVerify=true` disables origin certificate verification and is not an acceptable production default; it may only be used briefly during explicitly authorized troubleshooting and must be removed before go-live. See [origin parameters](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/).

## Staged validation

1. Confirm connector health and redundant edge connections without printing credentials.
2. Confirm the hostname route targets the intended local service and no catch-all exposes another service.
3. From an external client, verify `GET /api/v1/health` returns 200 over HTTPS and returns `X-Request-Id`.
4. From the VPS, verify only loopback/private reachability. From an external network, verify the VPS IP on `3001`, and any unapproved API route on `80/443`, fail.
5. Send two safe test requests with different real clients and verify normalized client identities do not collapse in rate limiting. Never log raw forwarding headers.
6. Verify exact-origin CORS and one approved read-only authenticated REST request.

## Socket.IO smoke

Cloudflare supports proxied WebSockets. WAF and rate-limit evaluation mainly affects the initial HTTP upgrade, so do not throttle reconnects aggressively. Cloudflare can restart connections during edge maintenance; clients must reconnect, re-authenticate, and rejoin. See [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/).

1. Load the HTTPS web page.
2. Connect to namespace `/chat` with the Supabase access token in `auth.token`, never a URL or log.
3. Verify token authentication and `chat.join`.
4. Verify a realtime message is received.
5. Disconnect, reconnect, re-authenticate, rejoin, and receive another message.
6. Repeat essential connection checks for `/notifications` and `/project-workspace` where applicable.
7. Verify an unrelated origin is rejected; production `WEB_URL` remains exact, never `*`.

## Independent rollback

- WAF issue: disable only the offending custom/managed rule override and retain the Tunnel.
- Rate-limit issue: disable or return only that rule to Log mode.
- Tunnel hostname issue: remove/disable only the hostname route after recording its prior target.
- Connector issue: restore the previous known-good connector version/configuration and service; do not publish the origin automatically.
- API issue: use Coolify to redeploy the prior known-good application SHA/image.

Do not roll back the database for an edge/network problem. Temporary direct Coolify HTTPS is an emergency fallback only with explicit owner authorization, valid TLS/authentication, restricted firewall exposure, and a timed plan to close it again.
