# PGS HUB - PHASE 3.5 OPERATIONAL VALIDATION REPORT

**Date:** 2026-08-26
**Auditor:** PGS HUB Production Hardening Team
**Scope:** Multi-role Business Operational Scenarios (Admin, Manager/Team Leader, Employee, Client)

---

## 1. Scenario Execution & Test Summary

Đã thiết lập và chạy thành công bộ kiểm thử end-to-end mô phỏng luồng nghiệp vụ thực tế (`apps/api/test/phase3-5-scenarios.e2e-spec.ts`):

| Bước  | Kịch bản nghiệp vụ (Business Scenario)                                                                                   | Role thực hiện             | Kết quả API / Logic                                                              | Trạng thái |
| :---: | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------- | :--------: |
| **1** | **Manager tạo Project:** Gán tự động vào phòng ban phụ trách, chặn can thiệp phòng ban khác.                             | `team_leader` (Manager)    | HTTP 201 Created. Ràng buộc `department_id = DEPT_ID`.                           |  ✅ PASS   |
| **2** | **Manager giao Task:** Tạo công việc và chỉ định Employee thuộc dự án.                                                   | `team_leader` (Manager)    | HTTP 201 Created. Ràng buộc `tasks.project_id`.                                  |  ✅ PASS   |
| **3** | **Employee nhận & update Task:** Xem danh sách việc được giao và chuyển trạng thái `in_progress`.                        | `employee`                 | HTTP 200 OK. Nhân viên chỉ sửa được status việc của mình.                        |  ✅ PASS   |
| **4** | **Manager xem Kanban Board:** Đồng bộ dữ liệu với cột `inProgress` theo `sort_order`.                                    | `team_leader` (Manager)    | HTTP 200 OK. Hiển thị đúng 1 task trong cột `inProgress`.                        |  ✅ PASS   |
| **5** | **Calendar Sync Deadline:** Lịch dự án truy vấn mốc thời gian `start_date` / `due_date`.                                 | `team_leader` / `employee` | HTTP 200 OK. Đồng bộ deadline `2026-08-30`.                                      |  ✅ PASS   |
| **6** | **Client Isolation:** Khách hàng không thể truy cập API nội bộ hoặc xem task nội bộ.                                     | `client`                   | HTTP 403 Forbidden cho `/admin/projects`, HTTP 200 cho `/client/me/projects`.    |  ✅ PASS   |
| **7** | **Realtime & Side Effects:** Broadcast Socket qua `WorkspaceRealtimeGateway` & gửi thông báo qua `NotificationsService`. | System Engine              | `task.created`, `task.updated`, `task.assigned` trigger đúng actor và recipient. |  ✅ PASS   |

---

## 2. Phase 4 Approval Workflow Architecture

Hệ thống bước sang **Phase 4: Approval Workflow** với các thành phần cốt lõi:

1. **Task Approval:** Phê duyệt công việc hoàn thành trước khi chuyển trạng thái `done`.
2. **File & Asset Approval:** Duyệt file thiết kế, ấn phẩm truyền thông trước khi bàn giao.
3. **Content Approval:** Phê duyệt bài viết mạng xã hội / kịch bản video.
4. **Customer Sharing Approval:** Kiểm duyệt tài liệu hoặc ấn phẩm trước khi hiển thị trên Client Portal.
5. **Approval History & Revisions:** Lưu vết lý do từ chối (`rejection_reason`), yêu cầu sửa đổi (`request_revision`), và lịch sử phản hồi.
6. **Notification Triggers:** Gửi thông báo tự động cho người duyệt khi có yêu cầu mới và cho người gửi khi có phản hồi duyệt.
