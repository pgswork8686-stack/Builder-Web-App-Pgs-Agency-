# PGS Hub API production checklist

## Pre-deploy

- [ ] Exact reviewed main SHA recorded and CI green
- [ ] Docker build and fake production container smoke green
- [ ] Graceful SIGTERM and negative environment startup checks green
- [ ] Rollback SHA/image recorded
- [ ] VPS and Coolify ready under separately approved access
- [ ] Cloudflare account owns DNS zone
- [ ] API hostname chosen
- [ ] Web hostname chosen
- [ ] Web DNS strategy = DNS Only to exact Vercel-required value
- [ ] Tunnel created
- [ ] `cloudflared` healthy
- [ ] Connector-to-API private route verified
- [ ] API public origin closed
- [ ] Port 3001 inaccessible publicly
- [ ] WAF baseline enabled after observation/review
- [ ] Rate-limit baseline enabled after observation/review
- [ ] API hostname Cache Bypass confirmed
- [ ] WebSocket proxy enabled
- [ ] Canonical client IP verified without raw-header logging
- [ ] DNS resolved
- [ ] TLS valid
- [ ] Exact `WEB_URL` confirmed
- [ ] Supabase URL/publishable/secret values available through approved secret channel
- [ ] `INITIAL_ADMIN_EMAIL` confirmed
- [ ] Production backup policy understood

## Deploy

- [ ] Configure the exact reviewed GitHub revision
- [ ] Build `apps/api/Dockerfile` with repository-root context
- [ ] Configure runtime environment/secrets in Coolify
- [ ] Configure container port 3001 with private/loopback-only reachability
- [ ] Configure Tunnel public-hostname route; no VPS A/AAAA record
- [ ] Deploy exact main SHA
- [ ] `/api/v1/health` returns 200 through Cloudflare
- [ ] REST and `X-Request-Id` smokes pass through Cloudflare
- [ ] Exact CORS allow/reject smoke passes
- [ ] Supabase auth smoke passes
- [ ] WebSocket connect/auth/join/send/receive/disconnect/reconnect/re-auth/rejoin passes
- [ ] Any approved Storage smoke passes and cleanup is recorded
- [ ] Logs are clean, structured, and contain no raw sensitive headers

## Post-deploy

- [ ] Health through Cloudflare PASS
- [ ] REST through Cloudflare PASS
- [ ] Supabase auth PASS
- [ ] CORS PASS
- [ ] WAF not blocking legitimate staff
- [ ] Rate limit not blocking legitimate staff or WebSocket reconnects
- [ ] Socket.IO PASS
- [ ] Direct VPS API access FAILS
- [ ] Port 3001 inaccessible publicly
- [ ] No secret leakage
- [ ] Cloudflare analytics/security events visible
- [ ] No unexpected 5xx responses
- [ ] CPU/RAM and connector health are reasonable
- [ ] Container restart and connector recovery tests pass
- [ ] Independent WAF/rate/Tunnel/connector/API rollback paths recorded
- [ ] Liveness, dependency, connector, and edge monitoring enabled
