# PGS HUB - PHASE 6 REPORTING & ANALYTICS DASHBOARD REPORT

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Hardening Team
**Scope:** Persona-based Dashboards (Admin, Manager, Employee), Project & Task Performance Metrics, Approval Status Metrics, Attendance Analytics

---

## 1. Overview & Architecture

Phân hệ **Phase 6: Reporting + Analytics Dashboard** đã được kiểm thử và xác thực đồng bộ trên cả tầng Backend API và giao diện Web Client:

### 1.1 Persona-based Dashboards

| Dashboard                                  | Đối tượng phục vụ             | Các chỉ số chính                                                                                                                                                                                                                                              | Tích hợp dữ liệu                                                                                        |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Admin Dashboard** (`/app/admin`)         | Ban Giám đốc, Quản trị viên   | - System Health check (API uptime)<br>- Tiến độ tổng hợp: Tổng số dự án (`stats.projectCount`)<br>- Doanh thu YTD (`stats.monthlyRevenue`)<br>- Khách hàng & Nhân sự (`stats.clientCount`, `stats.peopleCount`)<br>- Hàng đợi xét duyệt tài khoản & nghỉ phép | `ProjectsService`, `ClientsService`, `PeopleService`, `FinanceService`, `AdminService`                  |
| **Manager Dashboard** (`/app/team-leader`) | Trưởng phòng, Project Manager | - Dự án phụ trách trong phòng ban (`stats.projectCount`)<br>- Khối lượng công việc & Task quá hạn (`stats.nearDeadlines`)<br>- Đơn nghỉ phép / điều chỉnh công chờ duyệt (`stats.pendingApprovals`)<br>- Trạng thái chấm công hôm nay                         | `ProjectsService` (scoped), `TasksService`, `LeaveService`, `AttendanceService`, `OrganizationService`  |
| **Employee Dashboard** (`/app/employee`)   | Nhân viên                     | - Công việc được phân công hôm nay (`taskCount`)<br>- Giờ chấm công GPS hôm nay (`checkedInTime`)<br>- Số ngày phép còn lại trong năm (`leaveDaysRemaining`)<br>- Phân bổ task (Đang làm, Chờ duyệt, Quá hạn, Dự án)                                          | `TasksService` (assignee scope), `AttendanceService` (me), `LeaveService` (balances), `ProjectsService` |

---

## 2. Business Metrics & Analytics Aggregation

### 2.1 Project & Task Performance

- **Tiến độ dự án:** Theo dõi trạng thái `active`, `completed`, `on_hold`, tỷ lệ hoàn thành workflow items.
- **Hiệu suất công việc:** Thống kê khối lượng task theo mức độ ưu tiên (`urgent`, `high`, `medium`, `low`) và trạng thái (`todo`, `in_progress`, `review`, `done`).

### 2.2 Approval & Workflow Metrics

- Đếm số lượng yêu cầu phê duyệt đang chờ xử lý theo từng loại (`account`, `leave`, `attendance_adjustment`, `workflow_deliverable`).
- Tự động hiển thị huy hiệu (badge) số lượng chờ duyệt trên thanh điều hướng và thẻ hành động nhanh.

### 2.3 Attendance Analytics

- **Summary Metrics:** Tổng số ngày công chuẩn (`total_work_days`), số ngày có mặt (`present`), đi muộn (`late`), về sớm (`early_leave`), nghỉ phép (`on_leave`), vắng mặt (`absent`).
- **Phạm vi phân tích:** Hỗ trợ lọc theo phòng ban (`departmentId`) và khoảng thời gian (`from`, `to`).

---

## 3. Kết quả kiểm thử tự động

- **E2E Test Suite:** `apps/api/test/phase6-dashboards-analytics.e2e-spec.ts` **PASS** 5/5 tests.
- **Web Client Tests:** 14/14 test suites **PASS** (80/80 tests).
- **Production Build:** NestJS Backend & Next.js 16 (Turbopack) build thành công 100%.
