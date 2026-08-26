# PGS HUB - PHASE 4.5 APPROVAL STRESS VALIDATION REPORT

**Date:** 2026-08-26  
**Auditor:** PGS HUB Production Hardening Team  
**Scope:** Multi-level Approval Stress Test, Conflict Resolution, Role Security & Audit Immutability

---

## 1. Approval Stress Test Summary

Bộ test e2e chuyên sâu `apps/api/test/phase4-5-approval-stress.e2e-spec.ts` đã kiểm thử toàn diện các tình huống khắt khe trong vận hành doanh nghiệp thực tế:

| STT | Kịch bản kiểm thử | Mô tả chi tiết | Kết quả | Trạng thái |
|:---:|---|---|---|:---:|
| **1** | **Multi-level Approval** | Phê duyệt đa tầng: `Employee` tạo yêu cầu -> `Manager` (Team Leader) duyệt nội bộ -> `Director` (Admin) giám sát/ghi đè -> `Client` ký duyệt trên portal. | Yêu cầu `internal` & `client` được phân loại độc lập và lưu đúng stage/item target. | ✅ PASS |
| **2** | **Multiple Approvers & Conflicts** | Xử lý xung đột khi nhiều người duyệt cùng lúc hoặc Client từ chối sau khi nội bộ đã duyệt. | Khóa trạng thái `pending` cho tới khi tất cả các bên yêu cầu đồng thuận; từ chối sẽ chặn tiến trình và kích hoạt revision. | ✅ PASS |
| **3** | **Permission Bypass Protection** | Nhân viên thường (`employee`) cố tình gọi API phê duyệt `/approvals/:id/respond`. | Bị chặn tuyệt đối với HTTP 403 `WORKFLOW_PROJECT_MUTATION_DENIED`. | ✅ PASS |
| **4** | **Notification Flow** | Bắn thông báo và automation trigger tự động theo sự kiện (`requested`, `approved`, `rejected`). | Tích hợp qua `NotificationsService` và `AutomationService` với đúng recipient và action URL. | ✅ PASS |
| **5** | **Audit Trail Integrity** | Tính toàn vẹn của lịch sử duyệt trong `workflow_audit_events` và `workflow_approval_requests`. | Bảng audit kích hoạt RLS chỉ cho `service_role` ghi, bảo toàn mốc thời gian `responded_at` và `decision_note`. | ✅ PASS |

---

## 2. Phase 5 Attendance & HR Operations Architecture

Hệ thống bước sang **Phase 5: Attendance + HR Operations** với các tiêu chuẩn:

### 2.1 GPS Geofencing & Office Location Configuration
- **Văn phòng mặc định:** PGS Agency
  - **Vĩ độ (Latitude):** `20.9840365`
  - **Kinh độ (Longitude):** `105.7700707`
  - **Bán kính cho phép (Radius):** `150m`
- **Công thức tính khoảng cách:** Haversine formula tính toán chính xác khoảng cách cầu thực tế trên bề mặt trái đất giữa tọa độ thiết bị gửi lên và tọa độ văn phòng.
- **Bảo mật tọa độ:** Endpoint `/api/v1/attendance/policy` chỉ trả về yêu cầu `locationRequired: true` mà không làm lộ tọa độ thô của trụ sở cho client.

### 2.2 Quy trình chấm công & Quản lý nhân sự
1. **Check-in / Check-out GPS:** Ràng buộc thiết bị trong bán kính 150m. Nếu vượt quá bán kính -> Trả về lỗi 400 `ATTENDANCE_LOCATION_OUT_OF_RANGE`.
2. **Accuracy Validation:** Kiểm tra độ chính xác GPS `accuracyMeters` hợp lệ.
3. **Attendance Reports & Summary:** Lọc theo phòng ban, trạng thái (`present`, `late`, `early_leave`, `absent`, `on_leave`) và khoảng ngày.
4. **Manager Adjustment Approval:** Trưởng phòng / Quản trị viên duyệt điều chỉnh công ghi nhận lý do bắt buộc `reason`.
5. **Employee History:** Nhân viên tra cứu lịch sử chấm công cá nhân `/api/v1/attendance/me`.
