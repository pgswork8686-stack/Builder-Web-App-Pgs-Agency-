# VERCEL PREVIEW DEPLOYMENT GUIDE — PGS HUB

## 1. ARCHITECTURE OVERVIEW & DEPLOYMENT STRATEGY

PGS HUB is an Enterprise Agency Management System structured as a PNPM Monorepo:
- `apps/web`: Next.js 16 (App Router + Turbopack + TailwindCSS v4 + Supabase SSR).
- `apps/api`: NestJS 11 (Express + WebSockets Socket.IO + elevated Supabase service clients).
- `supabase`: PostgreSQL 17 database, Supabase Auth, Storage buckets, and Realtime.

### Vercel Runtime Assessment
1. **Next.js Web Frontend (`apps/web`)**:
   - **Vercel Native Deployment**: Ideal target. Vercel supports Next.js App Router, SSR middleware, dynamic server-rendering, and static asset optimization out-of-the-box.
2. **NestJS API Backend (`apps/api`)**:
   - **WebSockets / Long-lived connections**: NestJS utilizes `@nestjs/websockets` (`Socket.IO`) for real-time board updates, chat typing indicators, and presence. Serverless platforms (e.g. basic Vercel Serverless Functions) terminate long-lived TCP/WebSocket connections.
   - **Recommended Staging/Preview Architecture**:
     - **Frontend**: Deploy on **Vercel Preview**.
     - **Backend API**: Deploy on a long-lived Node.js container runner (Render, Railway, Fly.io, AWS ECS, or DigitalOcean App Platform) or Vercel with WebSockets proxied via Supabase Realtime Channels.

---

## 2. VERCEL PROJECT CONFIGURATION (WEB APP)

### A. Project Import Settings
- **Framework Preset**: `Next.js`
- **Root Directory**: `apps/web` (or Monorepo Root with Root Directory set to `apps/web`)
- **Build Command**: `cd ../.. && pnpm --filter web build` (or standard `pnpm run build` with Vercel monorepo detection)
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

### B. Required Environment Variables for Vercel

```env
# Next.js Public Endpoints
NEXT_PUBLIC_APP_URL=https://your-preview-deployment.vercel.app
NEXT_PUBLIC_API_BASE_URL=https://api-preview.pgs.vn/api/v1

# Supabase DEV / Preview Credentials (NEVER USE PRODUCTION REFS IN PREVIEW)
NEXT_PUBLIC_SUPABASE_URL=https://<your-dev-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Internal API Proxy / Backend Bridge (Optional for Next.js SSR fetch)
API_INTERNAL_URL=https://api-preview.pgs.vn/api/v1
```

---

## 3. NESTJS API RUNTIME PREPARATION

### Containerized Deployment (Recommended for Socket.IO & Cron)
Deploy `apps/api` via Docker / Node 20+ runtime:

```bash
# Build API
pnpm --filter api build

# Run in Production mode
pnpm --filter api start:prod
```

### Required Environment Variables for API Runtime:

```env
APP_ENV=preview
PORT=3001
WEB_URL=https://your-preview-deployment.vercel.app

SUPABASE_URL=https://<your-dev-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role secret)

INITIAL_ADMIN_EMAIL=admin.dev@pgs.vn
THROTTLE_TTL=60000
THROTTLE_LIMIT=1000
TRUST_PROXY=true
```

---

## 4. PRE-DEPLOYMENT VERIFICATION CHECKLIST

- [x] Monorepo passes typecheck: `pnpm -r typecheck` (PASS)
- [x] Monorepo passes lint: `pnpm -r lint` (PASS)
- [x] Monorepo passes format check: `pnpm -r format:check` (PASS)
- [x] Unit & E2E tests pass: `pnpm -r test` (501 unit + 94 e2e + 77 web tests PASS)
- [x] Production build passes: `pnpm -r build` (PASS)
- [x] Hard Safety: `umtgfaqjoqbsdzwpqizq` (Production) is strictly locked.
