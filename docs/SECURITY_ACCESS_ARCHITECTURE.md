# KIẾN TRÚC PHÂN QUYỀN VÀ BẢO MẬT HỆ THỐNG PGS HUB (SECURITY ACCESS ARCHITECTURE)

Tài liệu này xác lập toàn bộ kiến trúc phân quyền (RBAC), bảo mật tầng truy cập dữ liệu (Data Access Layer), ranh giới tin cậy (Trust Boundary), và chiến lược RLS (Row-Level Security) cho PGS Hub.

---

## 1. RANH GIỚI TIN CẬY & LUỒNG TRUY CẬP DỮ LIỆU (DATA ACCESS FLOW)

### 1.1. Ranh giới tin cậy (Trust Boundary)

```text
+-------------------------------------------------------------------------+
| UNTRUSTED ZONE (Browser / Client Device)                                 |
| - Next.js Web App                                                       |
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
| - Phân quyền vai trò thông qua ActiveAccountGuard & RolesGuard           |
| - Kiểm soát Ownership & Scope (ProjectAccess, TeamScope, Membership)     |
| - Quản lý duy nhất: SUPABASE_SECRET_KEY (service_role)                  |
| - Chạy Rate Limiting (Throttler), Helmet Headers, CORS Whitelist       |
+-------------------------------------------------------------------------+
                                    │
                                    │ Server-to-DB (service_role / RPC)
                                    ▼
+-------------------------------------------------------------------------+
| DATA PERSISTENCE LAYER (Supabase / Postgres 34 Tables)                   |
| - Row Level Security (RLS) bật 100% trên tất cả 34 bảng                 |
| - Phân loại 34 bảng là Backend-Only (Deny All Direct Browser Access)     |
| - Toàn bộ mutations thực thi qua Triggers & RPC bảo mật                  |
+-------------------------------------------------------------------------+
```

### 1.2. Trả lời chi tiết các câu hỏi Data Access:

1. **Frontend truy cập dữ liệu bằng gì?**
   - **100% dữ liệu nghiệp vụ** đi qua **NestJS API** (`/api/v1/*`) thông qua HTTP `fetch` kèm `Authorization: Bearer <access_token>` (`apps/web/lib/api/client.ts`).
   - Browser **KHÔNG BAO GIỜ** query bảng Postgres trực tiếp qua PostgREST (`supabase.from(...)`).
2. **Những module nào dùng Supabase browser client trực tiếp?**
   - Chỉ dùng cho **Supabase Auth Subsystem**: `signInWithPassword`, `signInWithOAuth`, `signOut`, `signUp`, `resetPasswordForEmail`, `updateUser`, `getSession`, `exchangeCodeForSession` (các file: `apps/web/app/auth/*`, `apps/web/components/app-shell/topbar.tsx`, `apps/web/lib/api/client.ts`).
3. **Backend dùng credential gì?**
   - NestJS khởi tạo `systemClientInstance` bằng `SUPABASE_SECRET_KEY` (`service_role`) bên trong `apps/api/src/supabase/supabase.service.ts`.
4. **Khả năng lọt secret sang frontend:**
   - **0%**. `SUPABASE_SECRET_KEY` chỉ cấu hình trong `apps/api/.env`, không có tiền tố `NEXT_PUBLIC_` và không bao giờ xuất hiện trong bundle của `apps/web`.
5. **Có route nào bypass authorization không?**
   - Chỉ duy nhất `GET /api/v1/health` là public không cần auth.
   - Endpoint `POST /api/v1/auth/bootstrap-admin` yêu cầu `AuthGuard` và chỉ chạy được khi hệ thống chưa có admin (ngăn chặn tái cấu hình bằng trigger DB P0002).

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

## 3. PHÂN LOẠI 34 BẢNG CƠ SỞ & CHIẾN LƯỢC RLS

Toàn bộ 34 bảng cơ sở trong schema `public` được phân loại theo mô hình bảo mật:

| Tên Bảng (34 Public Tables)        | Loại Truy Cập | Direct Browser? | NestJS Access | Service Role    | Chiến Lược RLS Đề Xuất                  |
| :--------------------------------- | :------------ | :-------------- | :------------ | :-------------- | :-------------------------------------- |
| `profiles`                         | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `account_approval_events`          | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `employee_profiles`                | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `departments`                      | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `teams`                            | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `client_companies`                 | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `client_memberships`               | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `projects`                         | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `project_memberships`              | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `project_services`                 | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `tasks`                            | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `task_comments`                    | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `project_files`                    | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `file_upload_sessions`             | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `services`                         | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `contracts`                        | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `invoices`                         | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `invoice_payments`                 | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `finance_audit_events`             | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `attendance_records`               | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `attendance_adjustments`           | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `attendance_photo_upload_sessions` | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `attendance_settings`              | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `leave_types`                      | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `leave_requests`                   | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `leave_balances`                   | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `leave_balance_adjustments`        | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `notifications`                    | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `notification_preferences`         | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `chat_conversations`               | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `chat_members`                     | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `chat_messages`                    | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `automation_rules`                 | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |
| `automation_executions`            | Backend-Only  | ❌ No           | ✅ Full       | ✅ Bypasses RLS | RLS Enabled (Deny-all anon/auth direct) |

> **Nguyên tắc thiết kế RLS:** Do 100% thao tác nghiệp vụ đều qua NestJS Backend và thực thi với quyền `service_role` (hoặc RPC định danh), việc bật RLS trên 34 bảng mà không mở RLS policy cho `authenticated` và `anon` tạo ra một hàng rào phòng thủ chiều sâu (Defense-in-Depth): nếu kẻ tấn công có được Token của người dùng và cố gắng gọi trực tiếp PostgREST Supabase API (`https://umtgfaqjoqbsdzwpqizq.supabase.co/rest/v1/*`), Postgres sẽ trả về kết quả rỗng `[]` hoặc Deny truy cập tuyệt đối.

---

## 4. ĐÁNH GIÁ CÁC PHÂN HỆ AN NINH (SECURITY AUDIT FINDINGS)

### 4.1. Storage Security

- **Project Files & Attendance Buckets:** Private buckets, không công khai URL tĩnh.
- **Signed URLs:** Toàn bộ download qua API backend sinh Short-lived Signed URL (thời hạn 60s–300s).
- **MIME & Size Whitelisting:** Nghiêm ngặt ở cả Zod Schema và Service layer (giới hạn 25MB cho Project Files, 10MB cho ảnh chấm công).
- **Sanitization:** Tên file được normalize NFKD và loại bỏ hoàn toàn các ký tự directory traversal (`/`, `\`, `..`).

### 4.2. WebSocket / Realtime Security

- **Authentication:** `handleConnection` xác thực Bearer token trực tiếp với `auth.getUser()` và kiểm tra profile trạng thái `active`. Socket không hợp lệ sẽ bị force disconnect ngay lập tức.
- **Room Authorization:**
  - `chat.join`: Bắt buộc kiểm tra `requireConversationMembership` trước khi cho phép join room Socket `chat:<conversationId>`. Người ngoài cuộc trò chuyện không thể nghe lén hoặc phát tán tin nhắn.
  - `workspace.join`: Bắt buộc kiểm tra quyền thành viên dự án (`requireProjectAccess`) trước khi join room `project:<projectId>`.

### 4.3. HTTP & API Hardening

- **Helmet:** Cấu hình CSP, HSTS (`maxAge: 31536000`), noSniff, frameguard.
- **CORS:** Whitelist nghiêm ngặt domain frontend (`NEXT_PUBLIC_APP_URL`).
- **Rate Limiting:** ThrottlerGuard bảo vệ brute-force / DDoS.
- **Exception Sanitization:** `HttpExceptionFilter` che giấu toàn bộ internal SQL errors và stack traces khỏi client responses trong production.
