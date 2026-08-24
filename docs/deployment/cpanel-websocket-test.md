# cPanel Socket.IO deployment-day test

The shared host's WebSocket capability is unknown until this test runs against the real deployment. Do not weaken gateway authentication, switch to wildcard CORS, place access tokens in URLs/logs, or mark the hosting accepted without the full sequence.

## Prerequisites

- Health, exact CORS, Supabase Auth, and one read-only REST request already pass.
- Use two owner-approved smoke users and an approved conversation. Keep each short-lived Supabase access token only in the test client's in-memory `auth.token` field.
- Test namespace URL: `https://apihub.pgsagency.vn/chat`. Socket.IO transport path remains its standard `/socket.io/`; `/chat` is the namespace.
- Observe browser/client events, API stdout/stderr, HTTP status, and proxy errors without printing tokens.

## Required sequence

1. Connect with `socket.io-client` to the namespace using `{ auth: { token }, transports: ['websocket'] }` and exact web origin behavior.
2. Confirm the WebSocket upgrade/Socket.IO handshake succeeds and the valid token is accepted.
3. Connect with no token; require rejection/disconnect.
4. Connect with an invalid placeholder token; require rejection/disconnect and no sensitive error detail.
5. With the valid client, emit `chat.join` for an authorized conversation UUID; require `{ ok: true }`.
6. Emit `chat.join` for a conversation the user cannot access; require denial.
7. Send a smoke message through the normal authorized application/REST flow and require the second authorized client to receive the realtime event.
8. Disconnect the first client cleanly.
9. Reconnect it, provide a fresh/valid `auth.token`, and require authentication again.
10. Rejoin the authorized room; do not assume room membership survived disconnect.
11. Send a second smoke message and require realtime receipt.
12. Disconnect both clients and check Passenger/API logs for proxy errors, repeated disconnects, or secret leakage.

Also repeat basic connect/reconnect checks for `/notifications` and `/project-workspace` if those features are in the release smoke scope.

## Decision gate

```text
REST PASS + AUTH PASS + SUPABASE PASS + SOCKET.IO PASS
=> CPANEL_TEMPORARY_HOSTING_ACCEPTED

REST PASS + AUTH PASS + SOCKET.IO FAIL due provider upgrade/connection limits
=> CPANEL_REST_ONLY
=> VPS_REQUIRED_FOR_FULL_PGS_HUB
```

Do not conceal the REST-only outcome or add insecure polling/auth bypasses. Capture provider response headers/status and a redacted log excerpt for escalation. A VPS/Coolify deployment remains the full-feature fallback.
