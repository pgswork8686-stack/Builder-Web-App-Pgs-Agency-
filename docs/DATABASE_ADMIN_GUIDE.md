# HƯỚNG DẪN QUẢN TRỊ CƠ SỞ DỮ LIỆU PGS HUB (DATABASE ADMIN GUIDE)

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)

> [!IMPORTANT]
> **NEVER USE BUSINESS CODE AS DATABASE PRIMARY KEY / FOREIGN KEY.**
> UUID (UUIDv4) luôn là định danh kỹ thuật chính (Primary Key & Foreign Key) của mọi quan hệ trong hệ thống.
> Business Code (Mã nghiệp vụ như `KH_01`, `NV_01`, `DA_01`) chỉ phục vụ giao diện người dùng, tìm kiếm, xuất báo cáo và hiển thị trực quan trong Supabase Table Editor.

---

## 2. BẢNG MÃ NGHIỆP VỤ CHUẨN (PGS HUB BUSINESS CODES)

Mọi mã nghiệp vụ trong PGS Hub tuân theo định dạng chuẩn: `PREFIX_XX` (Tối thiểu 2 chữ số zero-padded, tự động tăng và transaction-safe thông qua PostgreSQL Sequences).

| Đối tượng (Entity)      | Tiền tố (Prefix) | Ví dụ mã                   | Cột dữ liệu (Database Column) | Bảng gốc (Source Table)          |
| :---------------------- | :--------------- | :------------------------- | :---------------------------- | :------------------------------- |
| **Khách hàng**          | `KH_`            | `KH_01`, `KH_02`, `KH_100` | `client_code`                 | `public.client_companies`        |
| **Nhân sự / Nhân viên** | `NV_`            | `NV_01`, `NV_02`, `NV_15`  | `employee_code`               | `public.employee_profiles`       |
| **Tài khoản**           | `TK_`            | `TK_01`, `TK_02`, `TK_50`  | `account_code`                | `public.profiles`                |
| **Dự án**               | `DA_`            | `DA_01`, `DA_02`, `DA_35`  | `project_code`                | `public.projects`                |
| **Công việc / Task**    | `CV_`            | `CV_01`, `CV_02`, `CV_99`  | `task_code`                   | `public.tasks`                   |
| **Phòng ban**           | `PB_`            | `PB_01`, `PB_02`           | `department_code`             | `public.departments`             |
| **Nhóm / Team**         | `N_`             | `N_01`, `N_02`             | `team_code`                   | `public.teams`                   |
| **Dịch vụ**             | `DV_`            | `DV_01`, `DV_02`           | `service_code`                | `public.services`                |
| **Hợp đồng**            | `HD_`            | `HD_01`, `HD_02`           | `contract_code`               | `public.contracts`               |
| **Hóa đơn**             | `HDON_`          | `HDON_01`, `HDON_02`       | `invoice_code`                | `public.invoices`                |
| **Thanh toán**          | `TT_`            | `TT_01`, `TT_02`           | `payment_code`                | `public.invoice_payments`        |
| **Nghỉ phép**           | `NP_`            | `NP_01`, `NP_02`           | `leave_code`                  | `public.leave_requests`          |
| **Chấm công**           | `CC_`            | `CC_01`, `CC_02`           | `attendance_code`             | `public.attendance_records`      |
| **Duyệt tài khoản**     | `DTK_`           | `DTK_01`, `DTK_02`         | `approval_event_code`         | `public.account_approval_events` |
| **Quy tắc tự động hóa** | `TDH_`           | `TDH_01`, `TDH_02`         | `automation_rule_code`        | `public.automation_rules`        |
| **Hội thoại Chat**      | `HT_`            | `HT_01`, `HT_02`           | `conversation_code`           | `public.chat_conversations`      |
| **Loại nghỉ phép**      | `LNP_`           | `LNP_01`, `LNP_02`         | `leave_type_code`             | `public.leave_types`             |

---

## 3. PHÂN BIỆT MÃ NGHIỆP VỤ (BUSINESS CODE) VÀ SLUG NỘI BỘ (LEGACY SLUG)

Trong hệ thống có một số bảng chứa cột `code` cũ:

- `client_companies.code`: Mã rút gọn / Tên viết tắt doanh nghiệp phục vụ tìm kiếm nhanh (ví dụ: `SANGOOPEN`). **Mã nghiệp vụ chính thống để quản trị là `client_code` (`KH_01`)**.
- `departments.code`: Mã viết tắt định danh phòng ban trong hệ thống cấu hình (ví dụ: `TECH`). **Mã quản trị chính là `department_code` (`PB_01`)**.
- `teams.code`: Mã viết tắt đội nhóm (ví dụ: `FE_DEV`). **Mã quản trị chính là `team_code` (`N_01`)**.
- `services.code`: SKU/Mã gói dịch vụ (ví dụ: `SEO_STANDARD`). **Mã quản trị chính là `service_code` (`DV_01`)**.
- `leave_types.code`: Key định danh logic hệ thống (`annual`, `sick`, `unpaid`, `other`). **Mã quản trị chính là `leave_type_code` (`LNP_01`)**.

---

## 4. KIẾN TRÚC DỮ LIỆU 4 TẦNG (FOUR-TIER DATABASE ARCHITECTURE)

```mermaid
flowchart TD
    subgraph Tầng 1: Khóa kỹ thuật (Relational Source of Truth)
        A[UUID Primary Keys]
        B[UUID Foreign Keys & Relational Integrity]
    end

    subgraph Tầng 2: Mã định danh đối tượng (Entity Business Codes)
        C[KH_01, NV_01, TK_01, DA_01, CV_01, TDH_01, HT_01, LNP_01...]
        D[PostgreSQL Sequences & Format Check Constraints]
        E[Immutability Triggers]
    end

    subgraph Tầng 3: Mã dễ đọc trên bảng gốc (Companion Business Codes)
        F[client_code, project_code, user_code, rule_code, conversation_code, leave_type_code...]
        G[Auto Sync Triggers on Insert/Update]
        H[Override Protection & NULL Propagation]
    end

    subgraph Tầng 4: Lớp xem quản trị & báo cáo (Admin Readable Views)
        I[admin_account_approval_events]
        J[admin_clients / admin_people]
        K[admin_projects / admin_tasks]
        L[admin_attendance / admin_leave / admin_finance]
    end

    A --> C
    B --> F
    C --> F
    D --> C
    E --> C
    F --> I
    F --> J
    F --> K
    F --> L
```

1. **UUID Layer (Khóa kỹ thuật):** Là Source of Truth duy nhất cho mọi quan hệ FOREIGN KEY, cascade, index hiệu năng cao và Supabase Auth.
2. **Business Code Layer (Mã đối tượng gốc):** Sinh tự động bằng sequence `format_business_code()`, bất biến (immutable), không trùng lặp và không tái sử dụng.
3. **Companion Code Layer (Mã đồng hành trên bảng liên kết):**
   - Đặt ngay bên cạnh mỗi cột FK UUID trong bảng gốc (ví dụ: `client_company_id` song hành cùng `client_code`, `rule_id` cùng `rule_code`, `conversation_id` cùng `conversation_code`, `leave_type_id` cùng `leave_type_code`).
   - Tự động derive từ UUID cha thông qua PostgreSQL Trigger `BEFORE INSERT OR UPDATE`.
   - Nếu client/frontend gửi sai Companion Code -> Trigger tự động override theo UUID cha.
   - Nếu FK UUID bị đổi hoặc SET NULL -> Companion Code tự động cập nhật hoặc về NULL.
   - Giúp Quản trị viên mở trực tiếp **bảng gốc** trong Supabase Table Editor là đọc hiểu quan hệ ngay mà không phải giải mã chuỗi UUID.
4. **Admin View Layer (Lớp xem trực quan & báo cáo):** Cung cấp các view `admin_*` kết hợp thông tin đa bảng, tên người dùng tiếng Việt, và nhãn hiển thị trạng thái chuẩn hóa.

---

## 5. BẢN ĐỒ BẢNG GỐC VÀ CÁC CỘT COMPANION CODE (ORIGINAL TABLE COMPANION MAPPING)

Khi xem trực tiếp các bảng gốc trong Supabase Table Editor:

| Bảng Gốc (Base Table)              | Cột Khóa Ngoại UUID (FK Source of Truth)                                                           | Cột Companion Code (Dễ đọc)                                                                                          |
| :--------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `account_approval_events`          | `target_user`, `actor`                                                                             | `target_user_code` (`TK_XX`), `actor_user_code` (`TK_XX`)                                                            |
| `employee_profiles`                | `user_id`, `department_id`, `team_id`, `reports_to_user_id`                                        | `account_code`, `department_code`, `team_code`, `reports_to_user_code`                                               |
| `client_memberships`               | `client_company_id`, `user_id`, `created_by`                                                       | `client_code` (`KH_XX`), `user_code` (`TK_XX`), `created_by_code`                                                    |
| `projects`                         | `client_company_id`, `project_manager_user_id`, `created_by`, `updated_by`                         | `client_code` (`KH_XX`), `project_manager_code` (`TK_XX`), `created_by_code`, `updated_by_code`                      |
| `project_memberships`              | `project_id`, `user_id`, `created_by`                                                              | `project_code` (`DA_XX`), `user_code` (`TK_XX`), `created_by_code`                                                   |
| `project_services`                 | `project_id`, `service_id`, `created_by`, `updated_by`                                             | `project_code` (`DA_XX`), `service_code` (`DV_XX`), `created_by_code`, `updated_by_code`                             |
| `tasks`                            | `project_id`, `assignee_user_id`, `reporter_user_id`, `parent_task_id`, `created_by`, `updated_by` | `project_code`, `assignee_user_code`, `reporter_user_code`, `parent_task_code`, `created_by_code`, `updated_by_code` |
| `task_comments`                    | `task_id`, `author_user_id`                                                                        | `task_code` (`CV_XX`), `author_user_code` (`TK_XX`)                                                                  |
| `project_files`                    | `project_id`, `task_id`, `uploaded_by`                                                             | `project_code`, `task_code`, `uploaded_by_code`                                                                      |
| `file_upload_sessions`             | `project_id`, `task_id`, `user_id`                                                                 | `project_code`, `task_code`, `user_code`                                                                             |
| `contracts`                        | `client_company_id`, `project_id`, `created_by`, `updated_by`                                      | `client_code`, `project_code`, `created_by_code`, `updated_by_code`                                                  |
| `invoices`                         | `contract_id`, `client_company_id`, `project_id`, `created_by`, `updated_by`                       | `contract_code`, `client_code`, `project_code`, `created_by_code`, `updated_by_code`                                 |
| `invoice_payments`                 | `invoice_id`, `recorded_by`                                                                        | `invoice_code` (`HDON_XX`), `recorded_by_code` (`TK_XX`)                                                             |
| `finance_audit_events`             | `actor_user_id`                                                                                    | `actor_user_code` (`TK_XX`)                                                                                          |
| `attendance_records`               | `user_id`, `created_by`, `updated_by`                                                              | `user_code` (`TK_XX`), `employee_code` (`NV_XX`), `created_by_code`, `updated_by_code`                               |
| `attendance_adjustments`           | `attendance_record_id`, `requested_by`, `approved_by`                                              | `attendance_code` (`CC_XX`), `requested_by_code`, `approved_by_code`                                                 |
| `attendance_photo_upload_sessions` | `user_id`                                                                                          | `user_code` (`TK_XX`)                                                                                                |
| `leave_requests`                   | `user_id`, `leave_type_id`, `reviewer_user_id`, `cancelled_by`                                     | `user_code`, `leave_type_code` (`LNP_XX`), `reviewer_user_code`, `cancelled_by_code`                                 |
| `leave_balances`                   | `user_id`, `leave_type_id`                                                                         | `user_code` (`TK_XX`), `leave_type_code` (`LNP_XX`)                                                                  |
| `leave_balance_adjustments`        | `actor_user_id`                                                                                    | `actor_user_code` (`TK_XX`)                                                                                          |
| `notifications`                    | `recipient_user_id`, `created_by`                                                                  | `recipient_user_code`, `created_by_code`                                                                             |
| `notification_preferences`         | `user_id`, `updated_by`                                                                            | `user_code`, `updated_by_code`                                                                                       |
| `chat_conversations`               | `created_by`, `direct_user_low`, `direct_user_high`, `project_id`                                  | `created_by_code`, `direct_user_low_code`, `direct_user_high_code`, `project_code`                                   |
| `chat_members`                     | `conversation_id`, `user_id`                                                                       | `conversation_code` (`HT_XX`), `user_code` (`TK_XX`)                                                                 |
| `chat_messages`                    | `conversation_id`, `sender_user_id`                                                                | `conversation_code` (`HT_XX`), `sender_user_code` (`TK_XX`)                                                          |
| `automation_rules`                 | `created_by`, `updated_by`                                                                         | `created_by_code`, `updated_by_code`                                                                                 |
| `automation_executions`            | `rule_id`                                                                                          | `rule_code` (`TDH_XX`)                                                                                               |
| `services`                         | `created_by`, `updated_by`                                                                         | `created_by_code`, `updated_by_code`                                                                                 |
| `teams`                            | `department_id`, `leader_user_id`, `created_by`, `updated_by`                                      | `department_code`, `leader_user_code`, `created_by_code`, `updated_by_code`                                          |

---

## 6. BẢN ĐỒ ADMIN VIEWS (ADMIN VIEW MAPPING)

| Dữ liệu cần báo cáo tổng hợp | Bảng Backend (Chứa UUID)        | View khuyên dùng cho Admin (Dễ đọc & Giàu thông tin) |
| :--------------------------- | :------------------------------ | :--------------------------------------------------- |
| **Lịch sử duyệt tài khoản**  | `account_approval_events`       | 👉 **`admin_account_approval_events`**               |
| **Khách hàng doanh nghiệp**  | `client_companies`              | 👉 **`admin_clients`**                               |
| **Nhân sự & Phòng ban**      | `profiles`, `employee_profiles` | 👉 **`admin_people`**                                |
| **Phòng ban**                | `departments`                   | 👉 **`admin_departments`**                           |
| **Đội nhóm (Teams)**         | `teams`                         | 👉 **`admin_teams`**                                 |
| **Dự án**                    | `projects`                      | 👉 **`admin_projects`**                              |
| **Công việc (Tasks)**        | `tasks`                         | 👉 **`admin_tasks`**                                 |
| **Nhật ký chấm công**        | `attendance_records`            | 👉 **`admin_attendance_records`**                    |
| **Đơn xin nghỉ phép**        | `leave_requests`                | 👉 **`admin_leave_requests`**                        |
| **Hợp đồng kinh tế**         | `contracts`                     | 👉 **`admin_contracts`**                             |
| **Hóa đơn thanh toán**       | `invoices`                      | 👉 **`admin_invoices`**                              |
| **Giao dịch thanh toán**     | `invoice_payments`              | 👉 **`admin_payments`**                              |
| **Danh mục dịch vụ**         | `services`                      | 👉 **`admin_services`**                              |

---

## 6. CƠ CHẾ BẢO MẬT VIEW & FUNCTION (VIEW & FUNCTION SECURITY)

- Tất cả các View được định nghĩa với **`WITH (security_invoker = true)`**.
- Khi truy vấn qua View, quyền truy cập của người dùng được kiểm tra tự động theo chính sách RLS (Row Level Security) của bảng gốc bên dưới.
- Tất cả các stored procedure / trigger function tuân thủ quy tắc an toàn bảo mật tuyệt đối:
  - `SET search_path = ''` để loại bỏ lỗ hổng `function_search_path_mutable`.
  - Schema-qualify rõ ràng tất cả đối tượng (`public.*`, `pg_catalog.*`).
- **Quyền thực thi (Permissions):**
  - `GRANT SELECT` cho vai trò `service_role`.
  - `REVOKE ALL` đối với `anon`, `authenticated` và `PUBLIC` trên các Admin Views nội bộ.
  - Tuyệt đối không đưa mật khẩu, token, secret key hay session hash vào View.
