# PGS Hub API production checklist

## Pre-deploy

- [ ] Main CI green
- [ ] Docker build green
- [ ] Production-mode container smoke green with fake values
- [ ] Graceful SIGTERM smoke green
- [ ] Negative environment startup checks green
- [ ] VPS ready
- [ ] DNS ready
- [ ] Coolify ready
- [ ] API domain decided
- [ ] Web domain decided
- [ ] Supabase URL available
- [ ] Publishable key available
- [ ] Secret key available securely
- [ ] `INITIAL_ADMIN_EMAIL` confirmed
- [ ] Production backup policy understood
- [ ] Exact main Git SHA recorded
- [ ] Rollback SHA/image recorded

## Deploy

- [ ] Configure application from the reviewed GitHub repository
- [ ] Configure `apps/api/Dockerfile` with repository-root context
- [ ] Configure environment and secrets in Coolify
- [ ] Configure container port 3001
- [ ] Configure API domain
- [ ] Confirm port 3001 is not publicly exposed
- [ ] TLS issued
- [ ] HTTP redirects to HTTPS
- [ ] Deploy exact main SHA
- [ ] `/api/v1/health` returns 200
- [ ] REST smoke passes
- [ ] `X-Request-Id` response smoke passes
- [ ] CORS allow/reject smoke passes
- [ ] Auth smoke passes
- [ ] WebSocket connect/auth/join/send/receive/disconnect/reconnect smoke passes
- [ ] Storage smoke passes
- [ ] Logs are clean and structured

## Post-deploy

- [ ] No secret leakage
- [ ] No unexpected 5xx responses
- [ ] CPU and RAM are reasonable
- [ ] Container restart test passes
- [ ] Rollback path is known and recorded
- [ ] Liveness and dependency monitoring enabled
- [ ] Coolify and container logs retained according to policy
