# PGS HUB - PHASE 2.5 REAL DATA VALIDATION REPORT

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Hardening Team
**Scope:** `users`, `profiles`, `roles`, `permissions`, `departments`, `employee_profiles`

---

## 1. Executive Summary

Theo yêu cầu chuẩn bị dữ liệu trước khi chuyển giao hoàn toàn sang Phase 3 (Project Management), hệ thống thực hiện kiểm toán cấu trúc dữ liệu người dùng, vai trò, phòng ban và quan hệ cấp quản lý (manager mapping).

> [!IMPORTANT]
> **Quy tắc an toàn dữ liệu:** Không thực hiện bất kỳ thao tác tự ý backfill hoặc giả định dữ liệu nghiệp vụ nào. Toàn bộ các bản ghi thiếu thông tin bắt buộc phải được liệt kê vào danh sách chờ xử lý từ Quản trị viên doanh nghiệp.

---

## 2. Real Data Schema & Entity Validation

### 2.1 Profiles & Roles Validation

- **Bảng nguồn:** `public.profiles`
- **Ràng buộc kiểm tra:**
  - `role`: Bắt buộc thuộc tập hợp `('admin', 'team_leader', 'employee', 'accountant', 'client')`.
  - `account_status`: Bắt buộc thuộc `('pending', 'active', 'rejected')`.
  - `is_active`: Ràng buộc boolean mềm cho vòng đời tài khoản.
- **Tiêu chuẩn phân quyền:**
  - 100% tài khoản nội bộ (`admin`, `team_leader`, `employee`, `accountant`) phải có hồ sơ tương ứng.

### 2.2 Department & Manager Mapping Validation

- **Bảng nguồn:** `public.departments` & `public.employee_profiles`
- **9 Phòng ban chính thức (Official PGS Departments):**
  1. `PB_01` - Kinh doanh & Account (`ACCOUNT_SALES`)
  2. `PB_02` - Website & Technology (`WEB_TECH`)
  3. `PB_03` - SEO & Local Search (`SEO_LOCAL`)
  4. `PB_04` - Performance Marketing (`PERFORMANCE_MKT`)
  5. `PB_05` - Social Media & Content (`SOCIAL_CONTENT`)
  6. `PB_06` - Creative, Video & AI (`CREATIVE_AI`)
  7. `PB_07` - E-Commerce (`ECOMMERCE`)
  8. `PB_08` - Nhân sự & Hành chính (`HR_ADMIN`)
  9. `PB_09` - Tài chính & Kế toán (`FINANCE_ACC`)
- **Ràng buộc kiểm tra:**
  - `employee_profiles.department_id`: Nhân viên (`employee`, `team_leader`) chưa gán phòng ban.
  - `departments.head_user_id`: Phòng ban chưa có Trưởng phòng (Team Leader/Manager) chỉ định.

---

## 3. Discrepancy & Missing Data Checklist

Các bản ghi cần rà soát và chỉ định thủ công bởi Admin trên giao diện Quản trị tổ chức (`/app/admin/organization` & `/app/admin/people`):

| Phân loại                        | Tiêu chí thiếu                                   | Tác động hệ thống                                                | Trạng thái / Hành động yêu cầu                                         |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Users thiếu Role**             | `profiles.role IS NULL`                          | Bị `RolesGuard` chặn toàn bộ truy cập                            | Đưa vào danh sách chờ Admin phân vai trò tại trang Quản trị tài khoản. |
| **Team Leader thiếu Department** | `role = 'team_leader' AND department_id IS NULL` | Bị `ScopeGuard` & `ProjectsService.createProject` chặn tạo dự án | Yêu cầu gán phòng ban tại `employee_profiles`.                         |
| **Employee thiếu Department**    | `role = 'employee' AND department_id IS NULL`    | Không lọc được báo cáo phòng ban                                 | Gán phòng ban làm việc chính.                                          |
| **Department thiếu Head**        | `departments.head_user_id IS NULL`               | Không có người duyệt đơn nghỉ phép / ký duyệt dự án tự động      | Admin chỉ định Head qua trang Departments.                             |

---

## 4. Phase 3 Architecture Readiness Checklist

Toàn bộ các tiêu chí nền tảng của Phase 3 đã được rà soát và xác nhận sẵn sàng:

- [x] **Project thuộc Department:** Bảng `projects` có cột `department_id REFERENCES departments(id)` kèm index tối ưu truy vấn.
- [x] **Manager có quyền tạo Project trong Department:** `ProjectsService.createProject` kiểm tra vai trò `team_leader` và tự động ràng buộc `department_id` của chính mình.
- [x] **Employee Scope:** `getInternalProjects` giới hạn danh sách theo `project_memberships` (chỉ thấy dự án được phân công).
- [x] **Task bắt buộc thuộc Project:** Khóa ngoại `tasks.project_id NOT NULL REFERENCES projects(id) ON DELETE CASCADE`.
- [x] **Unified Datasource:** Danh sách (`/api/v1/projects/:id/tasks`), Kanban (`/api/v1/projects/:id/board`), Calendar (`/api/v1/projects/:id/calendar`) đều query đồng bộ từ `public.tasks`.
- [x] **Activity Log & Realtime:** Tích hợp `WorkspaceRealtimeGateway`, `NotificationsService` và `AutomationService` trên các sự kiện `task.created`, `task.updated`, `task.moved`.
- [x] **Approval Hook Ready:** Tích hợp sẵn `WorkflowRuntimeService` và `workflow_approval_requests` để kết nối phê duyệt ở Phase 4.
