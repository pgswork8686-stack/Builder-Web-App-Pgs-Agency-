# PGS Hub Operations

## Startup checks

1. API boots and logs `PGS Hub API started on port 3001`.
2. Web service starts on port `3000`.
3. API health check returns OK at `/api/v1/health`.
4. Web can call `NEXT_PUBLIC_API_URL`.
5. Supabase Auth redirects back to the web domain.

## Common issues

### API cannot start

- Check `APP_ENV`, `PORT`, `WEB_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `INITIAL_ADMIN_EMAIL`.
- Confirm no secret is accidentally configured on the web service.
- Inspect API service logs in Coolify or the host process manager.

### Login or account bootstrap fails

- Confirm Supabase Auth provider settings and redirect URLs.
- Confirm the singleton admin email is set to `pgsword6868@gmail.com`.
- Check API auth guard logs and Supabase Auth user state.

### Migration failure

- Do not edit historical migrations that have already been applied.
- Read the exact SQL error and create a new additive migration if the broken migration already reached a shared environment.
- Re-run Supabase advisors after security or index changes.

### Storage upload failure

- Confirm the relevant bucket is private.
- Check signed upload/session creation in the API.
- Verify MIME type, file size, and object path validation.

### Socket failure

- Confirm the client is sending a valid Supabase access token.
- Confirm `WEB_URL` matches the browser origin.
- Check server-side room authorization for project/chat/notification IDs.

### Automation failure

- Check `automation_executions` for `failed` rows and error payloads.
- Re-run scheduled automation from the admin automation page if safe.
- Review idempotency keys before retrying event-driven actions.

## Logs

- API logs: Coolify service logs or the host process manager for the API container.
- Web logs: Coolify service logs or the host process manager for the web container.
- Database logs: Supabase dashboard logs/advisors.
- Auth logs: Supabase Auth logs.

## Backups

Before production migrations, take a Supabase backup/snapshot where available. For high-risk schema changes, test against a staging project with production-like data shape first.
