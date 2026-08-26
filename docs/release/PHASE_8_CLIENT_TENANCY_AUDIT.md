# PGS HUB - PHASE 8.1 CLIENT TENANCY AUDIT REPORT

**Date:** 2026-08-26  
**Auditor:** PGS HUB Production Hardening Team  
**Scope:** Multi-Tenant Client Boundary, Data Isolation Enforcing, Foreign Key Relationships & Access Control Guards

---

## 1. Multi-Tenant Client Architecture & Tenant Boundary

Trong hệ thống PGS HUB, mỗi khách hàng (`client`) thuộc về một hoặc nhiều pháp nhân công ty khách hàng (`client_companies`). Ranh giới dữ liệu (Tenant Boundary) được thiết lập chặt chẽ ở cấp độ Backend API và Database RLS:

```
[Client Profile] (auth.users -> public.profiles with role = 'client')
       │
       ▼
[client_memberships] (user_id <-> client_company_id)
       │
       ▼
[client_companies] (Tenant Boundary Root)
       ├── [projects] (client_company_id)
       │      ├── [project_workflow_instances]
       │      │      ├── [project_workflow_stages]
       │      │      │      └── [project_workflow_stage_items]
       │      │      └── [workflow_approval_requests] (approval_type = 'client')
       │      ├── [files] (project_id, is_client_visible = TRUE)
       │      ├── [support_tickets] (client_company_id, project_id)
       │      └── [chat_conversations] (type = 'project', project_id)
       ├── [contracts] (client_company_id)
       ├── [invoices] (client_company_id)
       └── [payments] (client_company_id)
```

---

## 2. Table-by-Table Tenant Isolation Audit

| Bảng dữ liệu | Ràng buộc phân quyền Tenant | Cơ chế bảo vệ Isolation | Đánh giá |
|---|---|---|:---:|
| **`clients` / `client_companies`** | Khóa chính `id` | Client chỉ được truy vấn công ty mà mình có bản ghi trong `client_memberships`. | ✅ BẢO MẬT |
| **`projects`** | Cột `client_company_id` | Backend `ProjectsService.getClientProjects` và `ProjectsService.getClientProjectById` kiểm tra quan hệ `client_memberships`. Client A bị từ chối 403 khi gọi project của Client B. | ✅ BẢO MẬT |
| **`files` / `workspace_files`** | `project_id`, `is_client_visible` | Client chỉ tải được file thuộc project của công ty mình VÀ file phải có cờ `is_client_visible = TRUE` (hoặc đã được approve). Chặn hoàn toàn file nội bộ/draft. | ✅ BẢO MẬT |
| **`workflow_approval_requests`** | `project_id`, `approval_type` | Client chỉ được duyệt các yêu cầu có `approval_type = 'client'` thuộc project của công ty mình. Chặn can thiệp duyệt `internal`. | ✅ BẢO MẬT |
| **`invoices` & `contracts`** | `client_company_id` | Backend lọc cứng theo `client_company_id` lấy từ session profile. Client không thể đọc hóa đơn hoặc hợp đồng của doanh nghiệp khác. | ✅ BẢO MẬT |
| **`support_tickets`** | `client_company_id`, `project_id` | Client tạo ticket bắt buộc gắn với công ty và project được phân quyền. Chỉ xem danh sách ticket thuộc công ty mình. | ✅ BẢO MẬT |
| **`chat_conversations`** | `project_id`, `chat_members` | Client chỉ được tham gia room chat thuộc project của công ty mình. Chặn kết nối direct chat với nhân viên ngoài dự án. | ✅ BẢO MẬT |

---

## 3. Data Masking & Information Disclosure Prevention

Để bảo vệ bí mật kinh doanh của Agency, giao diện và API `/app/client` tuân thủ nguyên tắc cách ly thông tin:
1. **Ẩn tác vụ nội bộ (Internal Tasks):** Client không thấy các task con kỹ thuật, checklist nội bộ của nhân viên.
2. **Ẩn chi phí & tỷ suất lợi nhuận (Internal Margin & Cost Data):** Client chỉ xem giá trị hợp đồng/hóa đơn bàn giao, tuyệt đối không lộ chi phí nhân công, ngân sách nội bộ (`cost_amount`, `internal_notes`).
3. **Ẩn bình luận & ghi chú nội bộ (Internal Comments & Notes):** Bình luận nội bộ (`is_internal = TRUE`) và lý do từ chối kỹ thuật không được gửi về client frontend.
