# PGS Hub - UI Backend Gaps & Unsupported Features Report

> **Document Date:** 2026-08-18  
> **Branch:** `feat/ui-admin-foundation`  
> **Status:** Truthfully documented and safely handled in the UI.

This document lists all visual modules defined in the approved Figma designs that currently do not have backend API support. In accordance with the No Fake Data Policy, these modules preserve their approved Figma route and layout structure while presenting truthful, non-functional empty/preview states.

---

### 1. Payroll (Bảng Lương)

- **Affected Routes:**
  - `/app/accountant/payroll`
  - `/app/employee/payroll`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available. No backend tables or endpoints exist for automated payroll reconciliation, payslip generation, or salary calculation.
- **Current UI Behavior:** Displays a truthful empty state indicating payroll calculation is not yet connected to the backend. Action buttons ("Xuất bảng lương", "Tính toán tự động") are disabled. Dynamic month badge is rendered automatically from the current system date.
- **Fake Data Removed:** No fake payroll amounts, calculations, or dummy salary records.
- **Future Backend Scope:** Requires dedicated schema (`payroll_runs`, `payslips`), calculation rules, and reconciliation against attendance data.

---

### 2. General Documents Library (Thư viện Tài liệu PGS)

- **Affected Routes:**
  - `/app/admin/documents`
  - `/app/team-leader/documents`
  - `/app/employee/documents`
  - `/app/client/documents`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available for company-wide documents. (Note: Project-specific file attachments are fully supported via `/projects/:id/files` with private Supabase Storage and signed URLs).
- **Current UI Behavior:** Displays a truthful empty state ("Thư viện chưa có tài liệu") with a search bar. Upload actions are marked as preview.
- **Fake Data Removed:** No fake PDF templates or mock documents.
- **Future Backend Scope:** Requires a general `company_documents` table with category tags and role-based access permissions.

---

### 3. Project Expenses (Đề nghị Chi phí Dự án)

- **Affected Route:**
  - `/app/accountant/finance/project-expenses`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available. Phase 6 Finance currently supports Contracts, Invoices, and Payments.
- **Current UI Behavior:** Displays a truthful empty state with an informational banner explaining that expense requisition APIs are in the development roadmap.
- **Fake Data Removed:** No mock expense vouchers or dummy receipts.
- **Future Backend Scope:** Requires `project_expenses` table, approval workflows, and attachment upload support.

---

### 4. Client Support Desk (Trung tâm Hỗ trợ Khách hàng)

- **Affected Route:**
  - `/app/client/support`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available. No ticket tracking or SLA management system exists in the backend.
- **Current UI Behavior:** Displays truthful agency contact information (Hotline 1900 8686, Email CSKH, working hours) and directs users to real-time internal chat for immediate project collaboration. Ticket submission form is displayed in a read-only preview state.
- **Fake Data Removed:** No fake submission confirmations or mock ticket histories.
- **Future Backend Scope:** Requires `support_tickets`, `ticket_messages`, and SLA notification triggers.

---

### 5. System Settings Persistence (Cài đặt Hệ thống)

- **Affected Route:**
  - `/app/admin/settings`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available. System settings are managed via environment variables and Supabase Auth configuration.
- **Current UI Behavior:** Displays configuration options in read-only preview mode with an alert banner explaining that runtime configuration changes are not yet persisted via API. Save button is disabled.
- **Fake Data Removed:** Removed fake "Đã lưu cài đặt" simulated feedback loops and unverified toggle states.
- **Future Backend Scope:** Requires `system_settings` table and admin-only management API endpoints.

---

### 6. Export / Advanced Reporting (Xuất Báo cáo Excel/PDF)

- **Affected Routes:**
  - `/app/admin/reports`
  - `/app/team-leader/reports`
  - `/app/accountant/reports`
  - `/app/employee/reports`
- **UI State:** Implemented matching Figma layout.
- **Backend Status:** Not available. Data aggregates are queryable via standard REST endpoints, but dedicated binary file generation (Excel workbook / PDF rendering) is not implemented on the API server.
- **Current UI Behavior:** Displays report overview cards and links to real data views (Projects, Finance, Attendance). Export buttons are disabled with explicit "Chưa hỗ trợ" labels.
- **Fake Data Removed:** No fake export downloads or simulated background jobs.
- **Future Backend Scope:** Requires background worker or streaming service with `exceljs` / `pdfmake`.

---

### Summary Matrix

| Feature               | Routes                                     | Backend Available | UI Implementation                 | Fake Data Policy Compliant |
| --------------------- | ------------------------------------------ | ----------------- | --------------------------------- | -------------------------- |
| **Bảng lương**        | `/app/*/payroll`                           | ❌ No             | ✅ Empty State (Disabled Actions) | ✅ YES (100% Truthful)     |
| **Tài liệu PGS**      | `/app/*/documents`                         | ❌ No             | ✅ Empty State                    | ✅ YES (100% Truthful)     |
| **Chi phí dự án**     | `/app/accountant/finance/project-expenses` | ❌ No             | ✅ Empty State                    | ✅ YES (100% Truthful)     |
| **Hỗ trợ khách hàng** | `/app/client/support`                      | ❌ No             | ✅ Direct Contact + Info Banner   | ✅ YES (100% Truthful)     |
| **Cài đặt hệ thống**  | `/app/admin/settings`                      | ❌ No             | ✅ Read-only Preview              | ✅ YES (100% Truthful)     |
| **Xuất báo cáo**      | `/app/*/reports`                           | ❌ No             | ✅ Preview + Disabled Export      | ✅ YES (100% Truthful)     |
