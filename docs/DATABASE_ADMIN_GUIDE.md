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

---

## 3. KIẾN TRÚC DỮ LIỆU 3 TẦNG (THREE-TIER DATABASE ARCHITECTURE)

```mermaid
flowchart TD
    subgraph Tầng 1: Lưu trữ kỹ thuật (Engine / Normalized)
        A[UUID Primary Keys]
        B[UUID Foreign Keys & Constraints]
        C[PostgreSQL Sequences & Triggers]
    end

    subgraph Tầng 2: Mã định danh nghiệp vụ (Human-Readable Identifiers)
        D[KH_01, NV_01, DA_01, CV_01...]
        E[Transaction-safe Generation]
        F[Unique Indexes]
    end

    subgraph Tầng 3: Lớp xem quản trị (Admin Readable Views)
        G[admin_account_approval_events]
        H[admin_clients / admin_people]
        I[admin_projects / admin_tasks]
        K[admin_attendance / admin_leave / admin_finance]
    end

    A --> D
    B --> D
    C --> E
    D --> G
    D --> H
    D --> I
    D --> K
```

1. **UUID Layer (Khóa kỹ thuật):** Bảo đảm toàn vẹn dữ liệu, hiệu năng index của PostgreSQL, và tích hợp chuẩn với Supabase Auth.
2. **Business Code Layer (Mã dễ đọc):** Tự sinh tự động bằng sequence `format_business_code()`, không trùng lặp, không tái sử dụng mã khi bản ghi bị xóa (immutable sequence progression).
3. **Admin View Layer (Lớp xem trực quan):** Thay vì đọc hàng loạt UUID khó hiểu trong Table Editor, Quản trị viên chỉ cần mở các View có tiền tố `admin_` để xem đầy đủ tên người thực hiện, mã nghiệp vụ, và trạng thái tiếng Việt rõ ràng.

---

## 4. BẢN ĐỒ BẢNG SUPABASE CHO QUẢN TRỊ VIÊN (TABLE VS VIEW MAPPING)

Khi quản trị dữ liệu trực tiếp trong Supabase Dashboard / Table Editor:

| Dữ liệu cần quản trị        | Bảng Backend (Chứa UUID)        | View khuyên dùng cho Admin (Dễ đọc)    |
| :-------------------------- | :------------------------------ | :------------------------------------- |
| **Lịch sử duyệt tài khoản** | `account_approval_events`       | 👉 **`admin_account_approval_events`** |
| **Khách hàng doanh nghiệp** | `client_companies`              | 👉 **`admin_clients`**                 |
| **Nhân sự & Phòng ban**     | `profiles`, `employee_profiles` | 👉 **`admin_people`**                  |
| **Phòng ban**               | `departments`                   | 👉 **`admin_departments`**             |
| **Đội nhóm (Teams)**        | `teams`                         | 👉 **`admin_teams`**                   |
| **Dự án**                   | `projects`                      | 👉 **`admin_projects`**                |
| **Công việc (Tasks)**       | `tasks`                         | 👉 **`admin_tasks`**                   |
| **Nhật ký chấm công**       | `attendance_records`            | 👉 **`admin_attendance_records`**      |
| **Đơn xin nghỉ phép**       | `leave_requests`                | 👉 **`admin_leave_requests`**          |
| **Hợp đồng kinh tế**        | `contracts`                     | 👉 **`admin_contracts`**               |
| **Hóa đơn thanh toán**      | `invoices`                      | 👉 **`admin_invoices`**                |
| **Giao dịch thanh toán**    | `invoice_payments`              | 👉 **`admin_payments`**                |
| **Danh mục dịch vụ**        | `services`                      | 👉 **`admin_services`**                |

---

## 5. CƠ CHẾ BẢO MẬT VIEW (VIEW SECURITY & RLS)

- Tất cả các View được định nghĩa với **`WITH (security_invoker = true)`**.
- Khi truy vấn qua View, quyền truy cập của người dùng được kiểm tra tự động theo chính sách RLS (Row Level Security) của bảng gốc bên dưới.
- **Quyền thực thi (Permissions):**
  - `GRANT SELECT` cho vai trò `authenticated` và `service_role`.
  - `REVOKE ALL` đối với `anon` và `PUBLIC` để ngăn chặn rò rỉ dữ liệu ra ngoài.
  - Tuyệt đối không đưa mật khẩu, token, secret key hay session hash vào View.
