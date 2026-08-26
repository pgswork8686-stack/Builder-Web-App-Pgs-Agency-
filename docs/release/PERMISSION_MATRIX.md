# PGS HUB - ENTERPRISE PERMISSION MATRIX (Phase 2.4)

**Document Version:** 1.0.0  
**Effective Date:** 2026-08-26  
**Status:** Approved & Enforced

---

## 1. System Matrix Overview

| Feature / Domain | Action / API Capability | Admin | Manager (Team Leader) | Employee | Accountant | Client |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Projects** | Create Project | ✅ ALL | ✅ Own Dept | ❌ | ❌ | ❌ |
| | View Project List | ✅ ALL | ✅ Own Dept / Lead | ✅ Assigned Only | ✅ ALL (Read) | ✅ Owned Only |
| | Update Project Info | ✅ ALL | ✅ Own Dept / Lead | ❌ | ❌ | ❌ |
| | Delete Project | ✅ ALL | ❌ | ❌ | ❌ | ❌ |
| | Manage Memberships | ✅ ALL | ✅ Own Dept / Lead | ❌ | ❌ | ❌ |
| **Tasks** | Create Task | ✅ ALL | ✅ Own Projects | ❌ / Subtask | ❌ | ❌ |
| | Assign Task | ✅ ALL | ✅ Dept Members | ❌ | ❌ | ❌ |
| | Update Task Status | ✅ ALL | ✅ Own Projects | ✅ Assigned Task | ❌ | ❌ |
| | Delete Task | ✅ ALL | ✅ Own Projects | ❌ | ❌ | ❌ |
| **Attendance & Leave** | Check In / Out | ✅ | ✅ | ✅ | ✅ | ❌ |
| | Submit Leave Request | ✅ | ✅ | ✅ | ✅ | ❌ |
| | Approve Leave Request | ✅ ALL | ✅ Own Dept | ❌ | ❌ | ❌ |
| | View Attendance Logs | ✅ ALL | ✅ Own Dept | ✅ Self Only | ✅ ALL (Payroll) | ❌ |
| **Finance & Invoices** | Create Invoice / Contract | ✅ ALL | ❌ | ❌ | ✅ ALL | ❌ |
| | View Financial Reports | ✅ ALL | ❌ | ❌ | ✅ ALL | ❌ |
| | View Assigned Invoices | ✅ ALL | ❌ | ❌ | ✅ ALL | ✅ Self Company |
| | Record Payment | ✅ ALL | ❌ | ❌ | ✅ ALL | ❌ |
| **Services & Catalog** | Manage Services / Workflows | ✅ ALL | ❌ (View only) | ❌ | ❌ | ❌ |
| **User Administration** | Deactivate / Suspend Account | ✅ ALL | ❌ | ❌ | ❌ | ❌ |
| | Approve Account Signup | ✅ ALL | ❌ | ❌ | ❌ | ❌ |
| | Change Role / Department | ✅ ALL | ❌ | ❌ | ❌ | ❌ |

---

## 2. Department & Tenant Scope Rules

1. **Admin Scope:**
   - Hoàn toàn bypass department filter.
   - Thấy toàn bộ dữ liệu tổ chức, toàn bộ dự án, hợp đồng, nhân sự.
2. **Manager (Team Leader) Scope:**
   - Bị ràng buộc bởi `department_id` của chính mình.
   - Chỉ được duyệt đơn nghỉ phép, phân công công việc, quản lý tiến độ các dự án thuộc phòng ban phụ trách.
   - Bị chặn tuyệt đối nếu cố tình truy cập sang phòng ban khác.
3. **Employee Scope:**
   - Dữ liệu thu hẹp trong phạm vi: `assigned_to = user.id` hoặc `membership in project`.
   - Bị chặn khỏi các API quản trị và duyệt quyền.
4. **Client Scope:**
   - Bị ràng buộc bởi `client_id` liên kết với tài khoản.
   - Chỉ xem các dự án và hóa đơn của chính công ty mình.
