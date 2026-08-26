# PGS HUB - PHASE 5.5 HR OPERATION VALIDATION REPORT

**Date:** 2026-08-26  
**Auditor:** PGS HUB Production Hardening Team  
**Scope:** Employee Lifecycle, Termination & Access Control, Attendance Adjustment Workflow, Monthly HR Reporting & Analytics

---

## 1. Executive Summary

Bộ test e2e chuyên biệt `apps/api/test/phase5-5-hr-operations.e2e-spec.ts` đã kiểm tra trọn vẹn 4 kịch bản vận hành nhân sự thực tế:

| Kịch bản | Phạm vi kiểm tra | Kết quả kiểm thử | Đánh giá |
|---|---|---|:---:|
| **1. Employee Lifecycle** | Tạo hồ sơ, duyệt tài khoản, gán vai trò (`employee`) & phòng ban (`department_id`), cấp quyền truy cập hệ thống. | Nhân viên kích hoạt truy cập được chấm công và dashboard cá nhân. | ✅ PASS |
| **2. Termination Lifecycle** | Vô hiệu hóa tài khoản (`inactive`/`rejected`), chặn đăng nhập & API qua `ActiveAccountGuard`, giữ nguyên dữ liệu lịch sử. | Chặn tuyệt đối truy cập (HTTP 403) nhưng toàn vẹn dữ liệu quá khứ. | ✅ PASS |
| **3. Attendance Adjustment** | Yêu cầu điều chỉnh công, Manager/Admin phê duyệt với lý do bắt buộc, tự động lưu vết kiểm toán và thông báo. | Điều chỉnh thành công, ghi nhận `adjustedByUserId` & `reason`. | ✅ PASS |
| **4. Monthly Attendance Reporting** | Tính toán ngày công chuẩn (`work_days`), đi muộn (`late`), về sớm (`early_leave`), vắng mặt (`absent`), điều chỉnh (`adjusted`). | API trả về số liệu tổng hợp chính xác theo bộ lọc phòng ban và thời gian. | ✅ PASS |

---

## 2. Chi tiết kết quả kiểm tra vận hành

### 2.1 Employee Lifecycle & Phân quyền
- Khi nhân viên mới đăng ký, trạng thái là `pending`. Quản trị viên sử dụng trang xét duyệt `/app/admin/accounts/pending` để chỉ định `role` và `department_id`.
- Sau khi được phê duyệt (`approved_at` có giá trị và `account_status = 'active'`), nhân viên có quyền truy cập đầy đủ các chức năng phân hệ nhân sự theo ma trận phân quyền RBAC.

### 2.2 Termination Lifecycle & Bảo mật dữ liệu
- Khi nhân viên thôi việc, Admin/HR cập nhật `account_status = 'inactive'`.
- `ActiveAccountGuard` kiểm tra tại mỗi request: Nếu tài khoản không ở trạng thái `active`, hệ thống lập tức từ chối với mã lỗi HTTP 403 `ACCOUNT_INACTIVE`.
- Quan hệ khóa ngoại trong cơ sở dữ liệu sử dụng ràng buộc an toàn (không xóa cascade), đảm bảo toàn vẹn dữ liệu hợp đồng, công việc, chấm công và kiểm toán của nhân viên đã nghỉ.

### 2.3 Attendance Adjustment Workflow
- Chức năng điều chỉnh chấm công tại `POST /api/v1/attendance/records/:id/adjust` yêu cầu:
  - Chỉ `admin` hoặc `team_leader` (Manager) mới có quyền thực hiện.
  - Phải nhập lý do giải trình (`reason`) có độ dài hợp lệ.
  - Tự động kích hoạt thông báo `attendance.adjustment_requested` tới nhân viên liên quan.

### 2.4 Monthly Attendance Analytics
- Báo cáo tổng hợp chấm công tháng tích hợp trong `GET /api/v1/attendance/summary` và `GET /api/v1/attendance/directory` cung cấp:
  - Tổng số ngày làm việc chuẩn (`total_work_days`).
  - Số ngày có mặt (`present`), đi muộn (`late`), về sớm (`early_leave`), nghỉ phép (`on_leave`), vắng mặt (`absent`).
  - Lọc đa chiều theo phòng ban (`departmentId`) và khoảng thời gian (`from`, `to`).
