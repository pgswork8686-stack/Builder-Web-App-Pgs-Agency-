# PGS HUB - PHASE 7 NOTIFICATION & COMMUNICATION CENTER REPORT

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Hardening Team
**Scope:** Notification Center, ERP Event Triggers, Notification Lifecycle, Realtime Gateway & Resilient Delivery

---

## 1. Executive Summary

Phân hệ **Phase 7: Notification + Communication Center** đã được kiểm tra và xác thực hoàn chỉnh qua bộ test e2e `apps/api/test/phase7-notification-center.e2e-spec.ts` và giao diện `apps/web/components/phase7/notifications-center.tsx`:

| Tiêu chí                            | Nội dung kiểm thử                                                                                                                                              | Kết quả                                                                               | Trạng thái |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | :--------: |
| **1. ERP Triggers**                 | Tích hợp phát thông báo tự động từ tất cả các phân hệ cốt lõi: Task, Workflow Approval, Attendance Abnormal, Leave Request, Project Updates, Financial events. | Ghi nhận đầy đủ metadata, action URL và người nhận.                                   |  ✅ PASS   |
| **2. Notification Lifecycle**       | Vòng đời thông báo: `unread`, `read`, `markAllRead` (hàng loạt), bộ đếm nhanh `unreadCount`.                                                                   | Truy vấn có phân trang, đánh dấu đọc tức thời và đồng bộ qua socket.                  |  ✅ PASS   |
| **3. Realtime & Socket Gateway**    | WebSocket namespace `/notifications`, xác thực Bearer token, phòng riêng theo `user:${userId}`.                                                                | Dispatch sự kiện `notifications:new`, `notifications:read`, `notifications:read-all`. |  ✅ PASS   |
| **4. Duplicate Event Prevention**   | Chống lặp sự kiện thông báo thông qua khóa định danh duy nhất (`eventKey`) và kiểm tra lịch sử automation.                                                     | Không sinh thông báo trùng lặp khi người dùng retry hoặc thao tác liên tiếp.          |  ✅ PASS   |
| **5. Offline Recovery & Reconnect** | Khi client mất kết nối hoặc mở lại trình duyệt, API `/api/v1/notifications?unreadOnly=true` đồng bộ tức thì các thông báo bị lỡ.                               | Trạng thái hiển thị nhất quán, không sót thông báo quan trọng.                        |  ✅ PASS   |
| **6. Admin Broadcast**              | Quản trị viên phát thông báo khẩn cấp/thông báo chung tới toàn thể nhân sự đang hoạt động (`POST /api/v1/notifications/broadcast`).                            | Phân phối đồng thời qua realtime socket và lưu database cho toàn bộ thành viên.       |  ✅ PASS   |

---

## 2. Chi tiết các loại sự kiện ERP (Triggers Matrix)

| Phân hệ          | Event Type                                                | Tiêu đề mẫu                                        | Đối tượng nhận                       | Hành động khi nhấp                                           |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| **Tasks**        | `task.assigned`                                           | Công việc mới được giao                            | Người được giao (`assignee`)         | Điều hướng tới `/app/employee/tasks`                         |
| **Workflows**    | `workflow.approval.requested`                             | Yêu cầu duyệt ấn phẩm / giai đoạn                  | Quản lý (`team_leader`) / Khách hàng | Mở `/app/team-leader/approvals` hoặc `/app/client/approvals` |
| **Workflows**    | `workflow.approval.approved` / `rejected`                 | Ấn phẩm đã được duyệt / Yêu cầu chỉnh sửa          | Người tạo yêu cầu / Team dự án       | Mở chi tiết dự án `/app/projects/:id`                        |
| **Attendance**   | `attendance.abnormal` / `attendance.adjustment_requested` | Cảnh báo chấm công bất thường / Đã điều chỉnh công | Nhân viên có công bất thường         | Mở `/app/attendance`                                         |
| **Leave**        | `leave.requested` / `leave.approved`                      | Đơn xin nghỉ phép mới / Kết quả duyệt phép         | Trưởng nhóm / Nhân viên làm đơn      | Mở `/app/team-leader/approvals` hoặc `/app/leave`            |
| **Projects**     | `project.status_changed` / `project.created`              | Cập nhật tiến độ dự án                             | Thành viên dự án                     | Mở không gian làm việc dự án                                 |
| **Broadcasting** | `announcement` / `urgent`                                 | Thông báo toàn thể công ty                         | Toàn bộ nhân sự active               | Mở trang thông báo hoặc URL đính kèm                         |

---

## 3. Tùy chọn thông báo (Notification Preferences)

- Người dùng có thể cấu hình linh hoạt:
  - `inAppEnabled`: Bật/tắt chuông thông báo và thông báo realtime trong ứng dụng.
  - `emailEnabled`: Cấu hình nhận thông báo qua email.
- Khi người dùng tắt `inAppEnabled`, hệ thống tự động bỏ qua việc tạo thông báo in-app để tiết kiệm tài nguyên mà không gây lỗi nghiệp vụ.
