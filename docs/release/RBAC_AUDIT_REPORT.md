# PGS HUB - RBAC & SCOPE AUDIT REPORT (Phase 2.1)

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Hardening Team
**Scope:** Authentication, Role-based Access Control (RBAC), Department/Tenant Data Scopes

---

## 1. Executive Summary

Hệ thống PGS HUB hiện tại đã có nền tảng phân quyền cơ bản thông qua:

1. `AuthGuard`: Xác thực token Supabase JWT, nạp `RequestUser` (`role`, `accountStatus`, `departmentId`).
2. `ActiveAccountGuard`: Chặn truy cập đối với các tài khoản `pending`, `rejected`, hoặc `is_active = false`.
3. `RolesGuard` + `@Roles(...)`: Kiểm tra vai trò endpoint-level.

Tuy nhiên, để chuyển từ mô hình "CRUD có phân quyền cơ bản" sang mô hình "Hệ thống quản trị doanh nghiệp toàn diện (Enterprise Multi-tier Governance)", cần giải quyết các vấn đề sau:

- **Permission Granularity:** Hiện tại các controller dùng trực tiếp `@Roles('admin', 'team_leader', ...)`. Cần chuẩn hóa hệ thống Permission Actions (VD: `projects:create`, `projects:read`, `finance:approve`, `attendance:manage`).
- **Scope Enforcement:** Team Leader / Manager đang được gán scope department trong một số service (như `projects`, `attendance`), nhưng một số module (như `services`, `reports`, `work-calendar`) cần tăng cường kiểm tra cứng scope phòng ban/dữ liệu ở layer Guard hoặc Interceptor thay vì lặp lại thủ công trong Service.

---

## 2. Current Roles & Model Analysis

### 2.1. System Roles (`AppRole`)

- `admin`: Toàn quyền hệ thống, không bị giới hạn department scope.
- `team_leader` (Manager): Trưởng phòng/Trưởng bộ phận, quản lý nhân sự & dự án & công việc trong department phụ trách.
- `employee`: Nhân viên, chỉ xem và tương tác với công việc, dự án, chấm công, bảng lương của chính mình hoặc được phân công.
- `accountant`: Kế toán, quản lý hợp đồng, hóa đơn, thu chi, công nợ, bảng lương.
- `client`: Khách hàng doanh nghiệp/đối tác, xem dự án, hóa đơn, yêu cầu hỗ trợ liên quan đến tài khoản client của mình.

### 2.2. Department Scope Flow

```
Request
  ↓
[AuthGuard] (Xác thực JWT -> nạp RequestUser, bao gồm profile.role và employee_profiles.department_id)
  ↓
[ActiveAccountGuard] (Đảm bảo tài khoản Active)
  ↓
[RolesGuard / PermissionGuard] (Kiểm tra vai trò / quyền thực thi Action)
  ↓
[ScopeGuard / Service Data Scoper] (Áp dụng bộ lọc ADMIN: all / MANAGER: department / EMPLOYEE: assigned)
  ↓
Controller -> Service -> Supabase RLS / Client
```

---

## 3. Module Protection & Scope Review

| Module                   | Roles Allowed                                    | Current Scope Check                                                         | Recommendations for Enterprise Hardening                                                                                    |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Projects**             | Admin, Team Leader, Employee, Accountant, Client | Admin (All), Team Leader (Dept/Lead), Employee (Member), Client (Client ID) | Đã có `getInternalProjects` scope theo role & department. Cần đảm bảo endpoint POST/PATCH áp dụng strict department checks. |
| **Tasks**                | Admin, Team Leader, Employee, Accountant, Client | Scope theo project membership & assigned task                               | Chặn nhân viên sửa task ngoài phạm vi phân công.                                                                            |
| **Attendance & Leave**   | Admin, Team Leader, Employee, Accountant         | Admin (All), Team Leader (Dept approvals), Employee (Self check-in/leave)   | Đảm bảo Manager chỉ approve đơn nghỉ phép trong department của mình.                                                        |
| **Clients**              | Admin, Accountant, Client                        | Admin & Accountant (All/Management), Client (Self company)                  | Bổ sung phân quyền nhân viên phụ trách khách hàng.                                                                          |
| **Finance & Invoices**   | Admin, Accountant                                | Admin (All), Accountant (All financial records)                             | Cấm Employee/Team Leader truy cập trực tiếp các route quản lý tài chính nhạy cảm.                                           |
| **Services & Workflows** | Admin, Team Leader (Templates view)              | Admin quản trị dịch vụ                                                      | Giữ nguyên Admin quản trị danh mục, cho phép Team Leader chọn dịch vụ khi tạo dự án.                                        |
| **Work Calendar**        | Admin (Config), Others (View)                    | Admin cấu hình lịch làm việc                                                | Giữ nguyên.                                                                                                                 |
