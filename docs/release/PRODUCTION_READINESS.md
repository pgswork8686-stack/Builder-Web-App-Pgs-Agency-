# PGS HUB — BẢNG KIỂM TRA SẴN SÀNG RELEASE (PRODUCTION READINESS CHECKLIST)

## 1. Quality Gates & Build Verification

- [x] Remote CI Quality Gates: **PASS (100%)**
- [x] Test Suite Coverage: **PASS (674/674 tests passed across API Unit, API E2E, Web UI, Validation)**
  - API Unit: 501 passed
  - API E2E: 94 passed
  - Web UI: 77 passed
  - Validation: 2 passed
- [x] TypeScript & Next.js Builds: **0 Errors / 85 Web Routes + API Modules OK**
- [x] Prettier & ESLint: **0 Errors, 0 Format Drift**

## 2. Database & Migration Security

- [x] Database Production `umtgfaqjoqbsdzwpqizq`: **100% Read-only Protection (0 unauthorized writes)**
- [x] Legacy Phase 10 Migration `20260819130000_phase10_all_missing_modules.sql`: **Strictly Excluded & Isolated**
- [x] Modular Replacement Migrations: **Created, Tested & Verified (Expenses, Payroll, Documents, Support, Settings, Performance Hardening)**
- [x] Clean Disposable Database Preflight: **53 Migrations Applied with 0 Failures**
- [x] RLS Architecture: **Backend-only (service_role), Browser roles revoked (anon/authenticated fail-closed)**
- [x] Business Code Sequences: **Database-driven format constraints (`CP_`, `BL_`, `PL_`, `TL_`, `YC_`, `QTDV_`, `GDDA_`, `QTDA_`)**

## 3. Core Business Logic & UAT

- [x] Work Calendar Rules: **22/08 OFF, 29/08 WORK, 05/09 OFF, 12/09 WORK, Sunday OFF**
- [x] Deadline Alert: **Non-blocking warning banner on non-working dates**
- [x] Workflow Engine V1: **Template graph, Cycle detection, published immutability, runtime snapshot, task idempotency, atomic approvals**
- [x] Role-Based Access Control (RBAC): **5 distinct roles strictly isolated across all domains**

## 4. Production Release Gate Status

- **Current State:** `READY FOR PRODUCTION APPLY`
- **Production Writes:** `NONE` (Awaiting explicit release authorization: `APPROVE_PRODUCTION_RELEASE = YES`)
- **Required Production Actions Upon Approval:**
  1. Confirm database backup / PITR point.
  2. Apply selective migrations from `docs/release/PRODUCTION_MIGRATION_MANIFEST.md` (`20260820120000` through `20260820135000`).
  3. Configure production attendance hours (`workday_start_time`, `workday_end_time`) with approved business values.
  4. Run postflight validation and verify read-only health metrics.
