# Cloudflare proxy and client-IP audit

This records the application behavior found at base main `45c5a854928941ac424b86844e554c5390af6290` and the hardened target model. It is documentation and local code hardening only; it does not authorize infrastructure changes.

## Behavior before this branch

- `main.ts` set Express `trust proxy` to `1` when `TRUST_PROXY` was enabled. Production defaulted it to enabled, while an explicit environment value could override it.
- One trusted hop made Express derive `req.ip` from `X-Forwarded-For`. The application did not read `CF-Connecting-IP`.
- NestJS Throttler used its default tracker, `req.ip`, with the configured 60-second/120-request defaults. A Tunnel deployment could therefore collapse visitors onto a proxy address if Express did not expose the visitor correctly.
- Request logging emitted a validated request ID, method, path, status, and duration. It did not log IP or interpolate forwarding headers.
- Socket.IO namespaces `/chat`, `/notifications`, and `/project-workspace` used the exact `WEB_URL` for CORS and Supabase access-token authentication. None treated the source TCP address as a staff identity.

## Hardened model

`resolveClientIp` is now the only application resolver used by structured request logs and NestJS throttling:

1. With `TRUST_PROXY=false`, use the normalized immediate socket peer and ignore forwarding headers.
2. With `TRUST_PROXY=true`, accept a single syntactically valid `CF-Connecting-IP` only when the immediate socket peer is loopback, link-local, or a private address expected from host/Docker Tunnel plumbing.
3. If that header is absent or invalid, use normalized Express `req.ip`, then the socket peer.
4. If the immediate peer is public, ignore `CF-Connecting-IP` and `req.ip` derived through proxy headers and use the socket peer.

Values containing a list/comma, arrays, non-IP text, or excessive length are rejected. IPv4, IPv6, and IPv4-mapped IPv6 are normalized. Logs receive only this bounded normalized value; raw headers are never logged.

The local-peer condition is defense in depth, not proof that a request came from Cloudflare. The security boundary is the deployment rule that the API origin is not Internet reachable. A public reverse proxy that forwards attacker-supplied `CF-Connecting-IP` to the private application peer would violate this model. Keep Express at one trusted hop and do not change it to unrestricted proxy trust.

## Tests

Unit coverage includes valid Cloudflare IPv4/IPv6, malformed and multiple values, missing headers, spoofing from a public peer, direct/local development, request-ID preservation, and distinct throttler identities for two visitors behind the same Tunnel peer.

Reference: [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
