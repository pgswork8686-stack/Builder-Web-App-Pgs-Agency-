# PGS Hub Deployment

This guide describes the current production deployment path for PGS Hub.

## Prerequisites

- Node.js 22 or compatible Docker runtime.
- pnpm 11.20.0 for local builds.
- Supabase project with Auth, PostgreSQL, and Storage enabled.
- Google OAuth configured for the production domain.
- A deployment platform such as Coolify that can run two services from one repository.

## Environment variables

### Web service

```env
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### API service

```env
APP_ENV=production
PORT=3001
WEB_URL=https://app.example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-key
INITIAL_ADMIN_EMAIL=pgsword6868@gmail.com
```

Do not expose `SUPABASE_SECRET_KEY` to the web service.

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Coolify setup

Create two services from the same repository:

1. API service
   - Dockerfile: `Dockerfile`
   - Target: `api`
   - Port: `3001`
   - Health check: `/api/v1/health`
2. Web service
   - Dockerfile: `Dockerfile`
   - Target: `web`
   - Port: `3000`
   - Public domain: the app domain

Set `WEB_URL` on the API to the exact public web origin so CORS and Socket.IO allow the frontend.

## Supabase Auth redirect URLs

In Supabase Auth settings, add the production web URL and auth callbacks used by the app. Include local URLs only for development:

- `https://app.example.com`
- `https://app.example.com/auth/callback`
- `http://localhost:3000`
- `http://localhost:3000/auth/callback`

## Google OAuth

Configure Google OAuth with the Supabase callback URL for the project. Keep the Google client secret in Google/Supabase provider settings only; never commit it to this repository.

## Migration procedure

1. Review pending migration files under `supabase/migrations`.
2. Apply migrations to a development/staging Supabase project first.
3. Run Supabase security and performance advisors.
4. Apply the same committed migrations to production.
5. Verify `/api/v1/health`, login, protected routes, and core role workflows.

## Rollback strategy

- Prefer forward-fix additive migrations for schema corrections.
- If an application deploy fails, roll back the web/API image to the previous known-good version.
- If a migration introduces a data issue, stop writes, take a database backup/snapshot, and apply a reviewed corrective migration.

## Health check

API health endpoint:

```text
GET /api/v1/health
```

Expected response includes `status: "ok"` and `service: "pgs-hub-api"`.
