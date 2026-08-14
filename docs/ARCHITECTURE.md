# PGS Hub Architecture

PGS Hub is a pnpm monorepo with a Next.js web application, a NestJS API, shared packages, and Supabase/PostgreSQL migrations.

## Runtime flow

```text
Browser -> Next.js App Router -> NestJS API -> Supabase/PostgreSQL
```

The browser uses Supabase only for authentication/session handling. Business data reads and writes go through NestJS, where identity, role, membership, and tenant boundaries are derived server-side.

## Applications

- `apps/web`: Next.js 16 App Router UI for admin, accountant, team leader, employee, and client workflows.
- `apps/api`: NestJS REST API plus Socket.IO gateways for workspace, notifications, and chat realtime.
- `packages/*`: shared TypeScript packages for types, validation, API client support, UI/config foundations.
- `supabase/migrations`: immutable SQL migration chain for database schema, constraints, indexes, RLS, and helper functions.

## Core modules

- Auth/RBAC: Supabase token validation in Nest, role/status enforcement, pending/rejected/disabled account flows.
- Organization: departments, teams, employee profiles, client companies, client memberships.
- Projects/workspace: projects, project memberships, services, project services, tasks, Kanban ordering, calendar, comments, files.
- Attendance/leave: Vietnam business-day logic, check-in/check-out, evidence upload sessions, leave balances and approvals.
- Finance: contracts, invoices, payments, client-visible finance boundaries, transactional totals.
- Phase 7: notifications, user preferences, direct/project chat, automation rules/executions.

## Realtime

Realtime is implemented by NestJS Socket.IO gateways. Socket authentication uses Supabase access tokens. Room membership is checked server-side before a socket can join any project, notification, or chat room. Clients refetch authoritative state on reconnect or mutation failures.

## Database ownership

Business tables in exposed schemas are protected with RLS. Nest-only tables revoke access from `PUBLIC`, `anon`, and `authenticated`, and grant the required privileges to `service_role`. New helper functions use `SECURITY INVOKER`, fixed `search_path`, and explicit execute grants.

## Deployment shape

Deploy web and API as separate services from the same repository:

- Web service target: Docker target `web`, port `3000`.
- API service target: Docker target `api`, port `3001`.
- Supabase remains the managed database/auth/storage provider.
