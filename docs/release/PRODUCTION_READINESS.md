# PGS HUB — BẢNG KIỂM TRA SẴN SÀNG RELEASE (PRODUCTION READINESS CHECKLIST)

## 1. Quality Gates & Build Verification

- [x] Remote CI Quality Gates: **PASS (100%)**
- [x] Test Suite Coverage: **PASS (673/673 tests passed across API Unit, API E2E, Web UI, Validation)**
  - API Unit: 501 passed
  - API E2E: 94 passed
  - Web UI: 77 passed
  - Validation: 1 passed
- [x] TypeScript & Next.js Builds: **0 Errors / 86 Web Routes + API Modules OK**
- [x] Prettier & ESLint: **0 Errors, 0 Format Drift**

## 2. Database & Migration Security

- [x] Database Production `umtgfaqjoqbsdzwpqizq`: **100% Read-only Protection (0 unauthorized writes)**
- [x] Legacy Phase 10 Migration `20260819130000_phase10_all_missing_modules.sql`: **Strictly Excluded & Isolated**
- [x] Modular Replacement Migrations: **Created, Tested & Verified (Expenses, Payroll, Documents, Support, Settings, Performance Hardening)**
- [x] Clean Disposable Database Preflight: **53 Migrations Applied with 0 Failures**
- [x] Staging Cloud Database: **Pending instance creation approval (runbook and automated tests ready in `scripts/verify-release-migrations.mjs`)**
- [x] RLS Architecture: **Backend-only (service_role), Browser roles revoked (anon/authenticated fail-closed)**
- [x] Business Code Sequences: **Database-driven format constraints (`CP_`, `BL_`, `PL_`, `TL_`, `YC_`, `QTDV_`, `GDDA_`, `QTDA_`)**

## 3. Core Business Logic & UAT

- [x] Work Calendar Rules: **22/08 OFF, 29/08 WORK, 05/09 OFF, 12/09 WORK, Sunday OFF**
- [x] Deadline Alert: **Non-blocking warning banner on non-working dates**
- [x] Workflow Engine V1: **Template graph, Cycle detection, published immutability, runtime snapshot, task idempotency, atomic approvals**
- [x] Role-Based Access Control (RBAC): **5 distinct roles strictly isolated across all domains**

## 4. Release Pipeline & Production Gate Status

- **Automated Regression:** **PASS (673/673 tests passed)**
- **Live Staging UAT:** **PENDING (Awaiting cloud staging DB provisioning)**
- **Main Branch Status:** **NOT YET MERGED / 82 COMMITS AHEAD IN PR #7**
- **Production Database `umtgfaqjoqbsdzwpqizq`:** **100% UNTOUCHED / READ-ONLY (0 writes)**
- **Current Pipeline Stage:** `READY FOR STAGING PROVISIONING`
  *(NOT FULL UAT — NOT MAIN SYNCED — NOT READY FOR PRODUCTION APPLY UNTIL STAGING UAT IS PROVEN)*

---

## 5. Required Release Sequence (Strict Gate Order)
1. **Provision Real Staging Database** (Submit cost/plan approval if enabling Supabase Branching).
2. **Apply Release Migration Manifest to Staging** (53 clean migrations, NEVER monolithic Phase 10).
3. **Deploy Staging App & Conduct Full Role UAT** (Admin, Team Leader, Employee, Accountant, Client).
4. **Fix Any Staging Findings & Re-verify CI**.
5. **Merge PR #7 into `main`** upon successful non-production verification.
6. **Verify `main` CI on exact merged HEAD**.
7. **STOP & Require Explicit Authorization** (`APPROVE_PRODUCTION_RELEASE = YES`) before touching Production.
