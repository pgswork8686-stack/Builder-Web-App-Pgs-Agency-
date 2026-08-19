# KIẾN TRÚC PHÂN QUYỀN VÀ BẢO MẬT HỆ THỐNG PGS HUB (SECURITY ACCESS ARCHITECTURE)

Tài liệu này xác lập toàn bộ kiến trúc phân quyền (RBAC), bảo mật tầng truy cập dữ liệu (Data Access Layer), ranh giới tin cậy (Trust Boundary), phân loại RLS (Row-Level Security) và ma trận kiểm soát bảo mật cho PGS Hub.

---

## 1. RANH GIỚI TIN CẬY & LUỒNG TRUY CẬP DỮ LIỆU (DATA ACCESS FLOW)

### 1.1. Ranh giới tin cậy (Trust Boundary)

```text
+-------------------------------------------------------------------------+
| UNTRUSTED ZONE (Browser / Client Device)                                 |
| - Next.js Web App (Next.js 16)                                         |
| - Supabase Auth Client (@supabase/ssr browser client)                   |
| - Chỉ lưu: Session Tokens (access_token, refresh_token)                 |
| - Chỉ biết: NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY |
+-------------------------------------------------------------------------+
                                    │
                                    │ HTTPS + Bearer JWT
                                    ▼
+-------------------------------------------------------------------------+
| TRUSTED API BACKEND (NestJS Application)                                 |
| - Xác thực JWT thông qua AuthGuard (auth.getUser)                      |
| - User-scoped RLS Client (createUserClient) cho profiles check           |
| - Phân quyền vai trò thông qua ActiveAccountGuard & RolesGuard           |
| - Kiểm soát Ownership & Scope (ProjectAccess, TeamScope, Membership)     |
| - Quản lý duy nhất: SUPABASE_SECRET_KEY (service_role)                  |
| - Chạy Rate Limiting (Throttler), Helmet Headers, CORS Whitelist       |
+-------------------------------------------------------------------------+
                                    │
                                    │ Server-to-DB (service_role / RPC)
                                    ▼
+-------------------------------------------------------------------------+
| DATA PERSISTENCE LAYER (Supabase / Postgres 34 Base Tables)              |
| - Row Level Security (RLS) bật 100% trên tất cả 34 bảng                 |
| - 33 bảng Backend-Only (RLS Enabled không có policy cho auth/anon)       |
| - 1 bảng profiles có policy "profiles_select_own_policy" cho RLS        |
| - Toàn bộ mutations thực thi qua Triggers & RPC bảo mật                  |
+-------------------------------------------------------------------------+
```

### 1.2. Phân loại truy cập Supabase Client (Repo-wide Audit):

- **A. Browser Direct DB:** **0** (Không có bất kỳ component web nào gọi query database trực tiếp `supabase.from(...)`).
- **B. Backend User-scoped RLS Client (`createUserClient`):** Được sử dụng chính xác trong `apps/api/src/auth/auth.guard.ts` (dòng 68–75) để truy vấn thông tin tài khoản của chính user gọi request trên bảng `profiles` thông qua policy RLS `profiles_select_own_policy`.
- **C. Backend elevated `service_role` Client (`getSystemClient`):** Được sử dụng cho toàn bộ các business logic nghiệp vụ backend (Organization, Projects, Tasks, Workspace, Files, Finance, Attendance, Leave, Chat, Notifications, Automation) và quản trị Auth Admin.
- **D. Auth-only Supabase Usage:** Tại Next.js web (`apps/web/app/auth/*`, `apps/web/components/app-shell/topbar.tsx`, `apps/web/lib/api/client.ts`) dùng client publishable key thuần túy cho xác thực danh tính (login, logout, oauth, getSession).

---

## 2. MA TRẬN PHÂN QUYỀN 5 VAI TRÒ (5-ROLE ACCESS MATRIX)

| Tài Nguyên (Resource)          | Admin                                                   | Team Leader                                                   | Employee                                                      | Accountant                                        | Client                                                     |
| :----------------------------- | :------------------------------------------------------ | :------------------------------------------------------------ | :------------------------------------------------------------ | :------------------------------------------------ | :--------------------------------------------------------- |
| **Profiles / Accounts**        | Full CRUD + Phê duyệt (`pending` → `active`/`rejected`) | Read đồng nghiệp cùng team                                    | Read profile bản thân & đồng nghiệp cùng dự án                | Read thông tin cơ bản phục vụ bảng lương          | Read profile người phụ trách dự án                         |
| **Employee Profiles**          | Full CRUD                                               | Read hồ sơ thành viên thuộc team quản lý                      | Read hồ sơ cá nhân                                            | Read hồ sơ chấm công/lương toàn bộ NV             | Không có quyền truy cập (Deny)                             |
| **Phòng ban / Teams**          | Full CRUD cấu hình                                      | Read phòng ban, Quản lý team được giao làm leader             | Read phòng ban, team mình trực thuộc                          | Read danh mục phòng ban                           | Không có quyền truy cập (Deny)                             |
| **Clients & Doanh nghiệp**     | Full CRUD                                               | Read client gắn với dự án của team                            | Read client gắn với dự án tham gia                            | Read thông tin client để xuất hoá đơn/hợp đồng    | Read thông tin doanh nghiệp của chính mình                 |
| **Dự án (Projects)**           | Full CRUD toàn hệ thống                                 | Full quyền dự án mình làm PM / Leader; Read dự án được assign | Read & thao tác dự án mình là member                          | Read thông tin dự án để theo dõi hợp đồng/chi phí | Chỉ xem dự án thuộc công ty của mình (`client_company_id`) |
| **Công việc (Tasks & Kanban)** | Full CRUD                                               | Quản lý task thuộc project mình phụ trách                     | Tạo task, update task được assign hoặc trong project tham gia | Read task liên quan đến chi phí/dự án             | Read task công khai trong dự án của client                 |
| **Bình luận & Files**          | Full CRUD                                               | Quản lý bình luận/file trong dự án phụ trách                  | Tạo/xoá comment của mình; Upload/Download file dự án          | Download hoá đơn, chứng từ, file dự án            | Upload/Download file trong dự án của mình                  |
| **Chấm công & Nghỉ phép**      | Full CRUD + Cấu hình công ty                            | Xem/Duyệt chấm công, nghỉ phép của thành viên trong team      | Chấm công cá nhân, nộp đơn nghỉ, xem số dư phép               | Xem toàn bộ dữ liệu chấm công để tính lương       | Không có quyền truy cập (Deny)                             |
| **Hợp đồng & Hoá đơn**         | Full CRUD                                               | Read hợp đồng gắn với dự án phụ trách                         | Không có quyền truy cập (Deny)                                | Full CRUD quản lý thu/chi, thanh toán, công nợ    | Chỉ xem hợp đồng và hoá đơn của chính công ty mình         |
| **Thanh toán & Thu chi**       | Full CRUD                                               | Không có quyền truy cập (Deny)                                | Không có quyền truy cập (Deny)                                | Full CRUD ghi nhận thanh toán, theo dõi dòng tiền | Xem lịch sử thanh toán hoá đơn của công ty mình            |
| **Finance Audit Events**       | Full Read                                               | Không có quyền truy cập (Deny)                                | Không có quyền truy cập (Deny)                                | Ghi nhận audit khi thanh toán; Read audit         | Không có quyền truy cập (Deny)                             |
| **Thông báo (Notifications)**  | Toàn hệ thống                                           | Quản lý thông báo team/cá nhân                                | Chỉ nhận/đọc thông báo của chính mình                         | Chỉ nhận/đọc thông báo của chính mình             | Chỉ nhận/đọc thông báo của chính mình                      |
| **Trò chuyện (Chat)**          | Tham gia mọi kênh                                       | Kênh team, kênh dự án phụ trách, Direct message               | Kênh dự án tham gia, Direct message                           | Kênh dự án tham gia, Direct message               | Kênh dự án client, Direct message với PM                   |
| **Tự động hóa (Automation)**   | Full CRUD rules/execs                                   | Read quy tắc áp dụng cho team/dự án                           | Không có quyền truy cập (Deny)                                | Không có quyền truy cập (Deny)                    | Không có quyền truy cập (Deny)                             |

---

## 3. PHÂN LOẠI 34 BẢNG CƠ SỞ & CHIẾN LƯỢC RLS (PRODUCTION REALITY)

Hệ thống tuân thủ **MODEL A (Strict Backend Control + Defense-in-Depth RLS)** kết hợp 1 policy RLS được kiểm soát cho `profiles`:

| Tên Bảng (34 Public Tables)        | Phân Loại             | Direct Browser?    | NestJS Access                          | Service Role    | Trạng Thái RLS Thực Tế Trên Supabase Production                    |
| :--------------------------------- | :-------------------- | :----------------- | :------------------------------------- | :-------------- | :----------------------------------------------------------------- |
| `profiles`                         | User-Scoped + Backend | ❌ No direct query | ✅ `createUserClient` + `service_role` | ✅ Bypasses RLS | **RLS ENABLED** + `profiles_select_own_policy` (`auth.uid() = id`) |
| `account_approval_events`          | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `employee_profiles`                | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `departments`                      | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `teams`                            | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `client_companies`                 | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `client_memberships`               | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `projects`                         | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `project_memberships`              | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `project_services`                 | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `tasks`                            | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `task_comments`                    | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `project_files`                    | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `file_upload_sessions`             | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `services`                         | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `contracts`                        | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `invoices`                         | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `invoice_payments`                 | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `finance_audit_events`             | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `attendance_records`               | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `attendance_adjustments`           | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `attendance_photo_upload_sessions` | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `attendance_settings`              | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `leave_types`                      | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `leave_requests`                   | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `leave_balances`                   | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `leave_balance_adjustments`        | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `notifications`                    | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `notification_preferences`         | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `chat_conversations`               | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `chat_members`                     | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `chat_messages`                    | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `automation_rules`                 | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |
| `automation_executions`            | Backend-Only          | ❌ No              | ✅ Full                                | ✅ Bypasses RLS | **RLS ENABLED** (Không có policy cho auth/anon → Deny All)         |

### 3.1. Lý do tồn tại của `profiles_select_own_policy`:

Policy `profiles_select_own_policy` được khởi tạo tại migration `20260811100000_phase1_final_rls_lockdown.sql` và chuẩn hóa tại `20260813070000_phase8_lockdown_security_definer_helpers.sql`.

- **Mục đích:** Cho phép `AuthGuard` ở backend khi gọi `createUserClient(token)` có thể đọc hồ sơ (`profiles`) của chính user đó với điều kiện bảo mật `(SELECT auth.uid()) = id`.
- **Độ an toàn:** Policy chỉ cho phép `SELECT` dòng của chính mình, chặn hoàn toàn việc xem chéo hồ sơ người khác hoặc thực hiện `INSERT/UPDATE/DELETE` trực tiếp từ PostgREST.

---

## 4. BẢNG TỔNG HỢP LỖ HỔNG VÀ NGUY CƠ BẢO MẬT (SECURITY FINDINGS BY SEVERITY)

Sau khi hoàn tất kiểm toán toàn diện mã nguồn, database triggers, realtime sockets và negative e2e tests:

### 4.1. Critical Severity: **NONE**

- Không có lỗ hổng RCE, SQL Injection, Authentication Bypass, Secret Key Leakage hoặc Unauthenticated Admin Takeover nào.

### 4.2. High Severity: **NONE**

- Không có lỗ hổng IDOR, Privilege Escalation (nâng quyền trái phép), hoặc Data Tampering nào. Tất cả các endpoint quản trị đều có `RolesGuard`, `ActiveAccountGuard`, và kiểm tra ownership/membership chặt chẽ.

### 4.3. Medium Severity: **NONE**

- Không có lỗi CORS Misconfiguration, Insecure Direct Object Reference trong File Upload/Download, hay WebSocket Message Spoofing.

### 4.4. Low Severity: **NONE**

- Toàn bộ HTTP Security Headers (Helmet, CSP, HSTS, noSniff) và Exception Sanitization đã được cấu hình chặt chẽ trong `main.ts` và `HttpExceptionFilter`.
