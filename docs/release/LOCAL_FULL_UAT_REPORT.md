# LOCAL FULL UAT VERIFICATION REPORT — PGS HUB

_Branch: feat/workflow-engine-v1 | Environment: Local Full Stack (PostgreSQL 17 + Supabase + NestJS + Next.js)_

==================================================

1. VERIFIED RELEASE ENVIRONMENT & ARTIFACTS
   \==================================================

- **Source SHA**: `feat/workflow-engine-v1`
- **Remote CI State**: PENDING PUSH OF FINAL SHA
- **Local Supabase Database**: PostgreSQL 17 on `127.0.0.1:54322`
- **Local Supabase API / Kong**: `http://127.0.0.1:54321` (Auth, Storage, PostgREST, Realtime)
- **Local Supabase Studio**: `http://127.0.0.1:54323`
- **NestJS API Server**: `http://localhost:3001/api/v1` (Health: `{"status":"ok","service":"pgs-hub-api"}`)
- **Next.js Web Server**: `http://localhost:3000` (86 routes compiled & rendered)
- **Production Writes**: 0 (Production ref `umtgfaqjoqbsdzwpqizq` locked & unlinked)
- **Production Migrations**: 0

================================================== 2. MIGRATION CHAIN & DATABASE HARDENING
==================================================

- **Exact Migration Count**: 53 migrations
- **Legacy Monolithic Migration**: `20260819130000_phase10_all_missing_modules.sql.excluded` (Excluded, 0 conflicts)
- **Database Reset Exit Code**: 0 (`npx supabase db reset` completed cleanly)
- **Automated Migration Tests**:
  - `pnpm test:release-migrations` -> PASS (53/53 migrations verified)
  - `pnpm test:workflow-migrations` -> PASS (Full workflow DDL + constraints verified)

================================================== 3. COMPANY BUSINESS WORK HOURS & ATTENDANCE CONFIGURATION
==================================================

- **Timezone**: `Asia/Ho_Chi_Minh`
- **Workday Start**: `08:00:00` (Late grace: 5 min -> Late threshold: `08:06:00`)
- **Workday End**: `17:30:00` (Early leave grace: 5 min -> Early threshold: `< 17:25:00`)
- **Office Location**: `Tầng 2, DM 2-25, Điểm TTCN làng nghề dệt lụa Vạn Phúc, Hà Đông, Hà Nội`
- **GPS Radius Status**:
  - **Local UAT Temporary Value**: `100m`
  - **Production Value**: `PENDING OWNER APPROVAL`
- **Deterministic Attendance Boundary Test Results**:
  - Check-in `07:59` -> NOT late (`late_minutes = 0`) -> PASS
  - Check-in `08:00` -> NOT late (`late_minutes = 0`) -> PASS
  - Check-in `08:05` -> NOT late (`late_minutes = 0`) -> PASS
  - Check-in `08:06` -> LATE (`late_minutes = 6`) -> PASS
  - Check-out `17:24` -> EARLY LEAVE (`early_leave_minutes = 6`) -> PASS
  - Check-out `17:25` -> NOT early (`early_leave_minutes = 0`) -> PASS
  - Check-out `17:30` -> NOT early (`early_leave_minutes = 0`) -> PASS

================================================== 4. WORK CALENDAR AUTOMATION & SATURDAY RULES
==================================================

- Alternate Saturday Anchor: `2026-08-22` (OFF)
- Deterministic Work Calendar Evaluations:
  - `2026-08-22` (Sat): `is_working_day = false` (OFF) -> PASS
  - `2026-08-23` (Sun): `is_working_day = false` (OFF) -> PASS
  - `2026-08-29` (Sat): `is_working_day = true` (WORK) -> PASS
  - `2026-09-05` (Sat): `is_working_day = false` (OFF) -> PASS
  - `2026-09-12` (Sat): `is_working_day = true` (WORK) -> PASS

================================================== 5. 5-ROLE USER-FLOW UAT MATRIX RESULTS
==================================================

| Role            | Synthetic Identity              | Verified Capabilities & Flows                                                                                                               | Status   |
| :-------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------ | :------- |
| **Admin**       | `uat.admin.local@pgs.test`      | Auth bootstrap, Departments (12), Clients, Services, Project management, System settings, Workflow creation/publish, Attendance adjustments | **PASS** |
| **Team Leader** | `uat.leader.local@pgs.test`     | Auth login, Project oversight, Scoped attendance lookup, Task assignment, Support ticket response, Denied global settings (403)             | **PASS** |
| **Employee**    | `uat.employee.local@pgs.test`   | Auth login, GPS Check-in/Check-out, Personal attendance history, Task board, Expense submissions (CP), Personal payslip lookup (PL)         | **PASS** |
| **Accountant**  | `uat.accountant.local@pgs.test` | Auth login, Expense approvals (CP), Payroll run creation (BL), Payslip issuance (PL), Financial vouchers, Denied admin settings (403)       | **PASS** |
| **Client**      | `uat.client.local@pgs.test`     | Auth login, Client company binding, Support ticket creation (YC), Denied internal attendance/expenses/payroll (403)                         | **PASS** |

================================================== 6. WORKFLOW ENGINE V1 REAL LIFECYCLE & TASK IDENTITY
==================================================

- **Template Creation**: Created `QTDV_01` mapped to real service `DV_01` (Thiết kế Website) -> PASS
- **Template Stages & Delivery Mapping**: Created multi-stage graph with delivery items & SLA hours -> PASS
- **Template Publish & Set Default**: Published and marked as default template -> PASS
- **Runtime Instantiation**: Instantiated `project_workflow` for Project `Dự Án Phần Mềm UAT PGS Hub` -> PASS
- **Primary Task Creation**: Instantiated task `Task UAT Thiết Kế UI Header` -> PASS
- **Task Identity Proof**: `tasks.id` equals `workflow_primary_task_id` (`a99466ca-8fef-496d-b569-d10fc69e85ed`) across Kanban, Calendar, and Tasks Table -> PASS
- **Approval Flow**: Request approval -> Status `pending` -> Respond approval -> Status `approved` -> PASS

================================================== 7. MODULE LIFECYCLES: EXPENSES, PAYROLL, DOCUMENTS, SUPPORT, CHAT, STORAGE
==================================================

- **Expenses**: Created `CP_01` -> Accountant approved -> Client 403 denied -> PASS
- **Payroll**: Created Payroll Run `BL_01` -> Issued Payslip `PL_01` -> Employee view PASS -> Client 403 denied -> PASS
- **Company Documents**: Uploaded & indexed document `TL_01` -> Signed URL access verified -> PASS
- **Support Tickets**: Client opened ticket `YC_01` -> Team Leader replied -> PASS
- **Realtime & WebSockets**: Socket.IO gateway loaded, typing and message broadcast verified -> PASS
- **Direct Database Fail-Closed Security**: `anon` and `authenticated` browser roles receive 42501 permission denied on all backend business tables -> PASS

================================================== 8. AUTOMATED REGRESSION SUITE COUNTS (673/673 TOTAL)
==================================================

- `apps/api` Unit Tests: **501 passed** (59 test suites)
- `apps/api` E2E Tests: **94 passed** (9 test suites)
- `apps/web` Vitest Tests: **77 passed** (13 test files)
- `packages/validation` Tests: **1 passed** (1 test file)
- Total Monorepo Tests: **673 passed / 0 failed (100%)**
- TypeScript Compilation: **0 errors across all workspaces**
- Next.js Production Build: **86 static/dynamic routes compiled**
- NestJS API Production Build: **Compiled successfully**
- Defects: **P0 = 0 | P1 = 0 | P2 = 0**

================================================== 9. DOCUMENTATION & ARTIFACTS CREATED
==================================================

- `docs/release/LOCAL_FULL_UAT_REPORT.md`
- `docs/release/VERCEL_PREVIEW_DEPLOYMENT.md`
- `docs/user-guide/PGS_HUB_USER_GUIDE.md`
- `docs/user-guide/PGS_HUB_QUICK_START.md`
- `docs/user-guide/screenshots/`
