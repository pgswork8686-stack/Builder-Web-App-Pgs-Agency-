# PGS HUB — GIỚI HẠN & ĐẶC TẢ KỸ THUẬT WORKFLOW ENGINE V1 (LIMITATIONS)

Tài liệu ghi nhận các giới hạn kỹ thuật đã được cân nhắc thiết kế trong phiên bản Workflow Engine V1.

---

## 1. MÔ HÌNH QUAN HỆ PHỤ THUỘC (DEPENDENCY MODEL)

- **Dependency Type**: V1 chỉ hỗ trợ quan hệ `finish_to_start`. Các loại quan hệ khác (`start_to_start`, `finish_to_finish`, `start_to_finish`) chưa được kích hoạt.
- **DAG Strictness**: Mọi quan hệ phụ thuộc Stage và Item đều được kiểm tra chu trình (Cycle Detection) bằng Recursive CTE tại database trigger / RPC. Không cho phép quan hệ chéo service hay chéo template.
- **Lag Hours Calculation**:
  - `lag_hours` được tính toán dựa trên **Work Calendar** cấu hình của hệ thống (giờ làm việc hành chính, loại trừ thứ Bảy, Chủ Nhật và ngày lễ cấu hình).
  - Cột `eligible_at` tại `project_workflow_stage_dependencies` và `project_workflow_item_dependencies` lưu mốc thời gian thỏa mãn điều kiện sau khi tiền nhiệm hoàn tất cộng thêm lag giờ làm việc.

---

## 2. TÍNH BẤT BIẾN CỦA TEMPLATE ĐÃ PUBLISH (IMMUTABILITY)

- Khi một `workflow_templates` đạt trạng thái `published` hoặc `archived`:
  - Toàn bộ cấu trúc đồ thị bên dưới (Stages, Items, Stage Dependencies, Item Dependencies) trở thành bất biến (**Immutable**), được bảo vệ bởi trigger database (`trg_workflow_template_lifecycle_guard` và `trg_workflow_template_*_draft_guard`).
  - Để chỉnh sửa quy trình đã công bố, người dùng sử dụng tính năng **Clone Template** tạo một bản nháp mới (`draft`) với `version` tăng dần.

---

## 3. KHỞI TẠO & RÀNG BUỘC DỰ ÁN (RUNTIME ISOLATION)

- **Runtime Decoupling**: Khi áp dụng template vào dự án (`project_workflows`), toàn bộ cấu trúc được snapshot độc lập. Mọi thay đổi về sau của template không ảnh hưởng đến các dự án đang chạy.
- **Task Mapping**: Mỗi `project_workflow_stage_items` liên kết duy nhất với một Primary Task (`link_type = 'primary'`) qua `project_workflow_task_links`. Ràng buộc `uidx_project_workflow_task_links_primary` ngăn ngừa liên kết trùng lặp.
- **Ownership Verification**: Database triggers kiểm tra nghiêm ngặt tính toàn vẹn đa tầng: `project_id`, `project_workflow_id`, `project_workflow_stage_id`, `project_service_item_id` phải cùng thuộc về một thể thể thống nhất.

---

## 4. PHÂN QUYỀN & BẢO MẬT (SECURITY & PERMISSIONS)

- **RLS Lockdown**: Toàn bộ 13 bảng Workflow đều được khóa hoàn toàn quyền trực tiếp đối với các role client-facing (`anon`, `authenticated`). Mọi thao tác đọc/ghi đều phải thông qua API Backend được xác thực và ủy quyền (`service_role`).
- **Khách hàng (Client View)**:
  - Khách hàng chỉ có quyền xem (read-only) tiến độ quy trình của dự án mà công ty họ sở hữu.
  - Thông tin override nội bộ (`overridden_by`, `override_reason`) được che chắn tự động khỏi phản hồi trả về cho khách hàng.
- **Project Manager**:
  - Có quyền quản lý, thực thi, phê duyệt và kích hoạt override phụ thuộc trong phạm vi dự án được phân công.

---

## 5. TỐI ƯU HÓA ĐỒNG THỜI & KHÓA (CONCURRENCY & LOCKING)

- Các hàm RPC ghi đồ thị template tuần tự hóa theo thứ tự: Khóa hàng `workflow_templates` (`FOR UPDATE`) trước, sau đó khóa các bảng quan hệ theo thứ tự `SHARE` để tránh Deadlock và Race Condition khi đồng thời Publish và chỉnh sửa DML.
- Sắp xếp thứ tự Stage (`workflow_reorder_template_stages`) thực hiện hoán đổi nguyên tử (atomic) qua dải offset tạm thời để tránh vi phạm Unique Constraint `(workflow_template_id, sort_order)`.
