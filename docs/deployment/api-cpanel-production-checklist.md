# PGS Hub API cPanel production checklist

## Pre-deploy

- [ ] Exact reviewed main/artifact source SHA known
- [ ] Exact-head CI green, including cPanel Node 22 artifact job
- [ ] Node 22.23.0 selected
- [ ] Application mode is production
- [ ] Domain `apihub.pgsagency.vn` works
- [ ] HTTPS works
- [ ] Current test app backed up securely
- [ ] Artifact ZIP size and SHA-256 recorded and verified
- [ ] Artifact secret scan green
- [ ] Production environment values/secrets prepared through approved channel
- [ ] Production Supabase migration state already verified separately
- [ ] No production migration planned for this deployment
- [ ] Rollback files/procedure recorded

## Deploy

- [ ] Upload ZIP to `public_html/apihub`, not `public_html` root
- [ ] Verify checksum, then extract at application-root top level
- [ ] Confirm `app.js`, `package.json`, `package-lock.json`, `DEPLOYMENT_INFO.txt`, and `dist/main.js`
- [ ] Install runtime dependencies with locked npm procedure
- [ ] Configure environment variables in cPanel UI only
- [ ] Confirm cPanel supplies the validated `PORT`
- [ ] Startup file is `app.js`
- [ ] Restart application through cPanel UI

## Smoke

- [ ] `/api/v1/health` returns 200 with expected body
- [ ] Caller `X-Request-Id` is returned
- [ ] Exact web-origin CORS passes; unrelated origin fails
- [ ] Approved user login/auth passes
- [ ] Read-only application API passes
- [ ] Read-only Supabase-backed call passes
- [ ] Approved Storage smoke passes with cleanup plan
- [ ] Attendance read passes
- [ ] Project read passes
- [ ] Socket.IO handshake passes
- [ ] Socket.IO valid auth passes; missing/invalid auth fails
- [ ] Authorized `chat.join` passes; unauthorized join fails
- [ ] Realtime message receipt passes
- [ ] Disconnect/reconnect/re-auth/rejoin/second message passes
- [ ] Hosting decision gate is recorded

## Post-deploy

- [ ] Logs are clean and contain no secrets/tokens
- [ ] CPU and memory remain reasonable
- [ ] Application survives a cPanel UI restart
- [ ] WebSocket remains stable through the observation window
- [ ] No production synthetic business records remain
- [ ] Rollback remains immediately available
