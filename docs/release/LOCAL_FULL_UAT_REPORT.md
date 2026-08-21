# BÁO CÁO NGHIỆM THU ĐẦY ĐỦ TRÊN MÔI TRƯỜNG SUPABASE LOCAL (LOCAL FULL UAT REPORT)

_Hệ thống: PGS HUB — Enterprise Agency Management Platform_  
_Release Branch: `feat/workflow-engine-v1` | PR #7_  
_Verified Source Commit SHA:_ `57be53ca956802df1c45887bb8c35e47c59bd93b`  
_Local Supabase Reference: `http://127.0.0.1:54321` (Local Docker Supabase Stack)_  
_Production Project Ref: `umtgfaqjoqbsdzwpqizq` (STRICTLY LOCKED / READ-ONLY / 0 WRITES)_

---

## 1. TỔNG QUAN KẾT QUẢ NGHIỆM THU (EXECUTIVE SUMMARY)

| Hạng mục kiểm thử                              |      Trạng thái      | Ghi chú & Bằng chứng                                                                                                                  |
| ---------------------------------------------- | :------------------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Migration Preflight**                  |       **PASS**       | 53/53 migrations áp dụng thành công. Phase 10 monolithic hoàn toàn bị loại trừ (`.sql.excluded`).                                     |
| **Real Application Full UAT Matrix**           |       **PASS**       | Thực thi 100% qua Browser UI, NestJS HTTP API và WebSocket Realtime (5 vai trò: Admin, Leader, Employee, Accountant, Client).         |
| **Attendance Executable Boundary Assertions**  |       **PASS**       | Kiểm thử thuật toán tính giờ với các mốc `07:59`, `08:00`, `08:05`, `08:06`, `17:24`, `17:25`, `17:30` qua câu lệnh `ASSERT` thực tế. |
| **Real Supabase Storage Flow**                 |       **PASS**       | Upload file thực tế, tạo session, finalize metadata DB, sinh signed download URL, đọc object và xóa tệp an toàn.                      |
| **Chat / Realtime WebSocket Flow**             |       **PASS**       | Xác thực token kết nối Socket.IO thành công, xử lý broadcast tin nhắn, từ chối kết nối unauthenticated.                               |
| **Browser Direct Database Fail-Closed Matrix** |       **PASS**       | Xác nhận 14 bảng backend-only trả về lỗi 42501 (Permission Denied) cho cả 2 vai trò `anon` và `authenticated`.                        |
| **Automated Regression Suite**                 |       **PASS**       | **673 / 673 tests passed (100%)** trên 4 bộ test (API Unit, API E2E, Web UI, Validation).                                             |
| **Remote Code CI (Push & PR)**                 |       **PASS**       | GitHub Actions Run #32439721746 & #32439717875 hoàn tất `conclusion: success`.                                                        |
| **Defect Matrix**                              | **P0=0, P1=0, P2=0** | Không còn bất kỳ blocker hoặc lỗi chức năng nào.                                                                                      |

---

## 2. KẾT QUẢ KIỂM THỬ THỰC THI 10 GIAI ĐOẠN (10-PHASE UAT MATRIX)

### Giai đoạn 1: Quản trị viên (Admin)

- Đăng nhập xác thực và truy vấn `/auth/me` thành công với vai trò `admin`.
- Quản lý Cơ cấu tổ chức: Truy vấn 12 phòng ban qua API `/admin/departments`.
- Quản lý Khách hàng: Truy vấn danh sách khách hàng qua `/admin/clients`.
- Quản lý Danh mục dịch vụ: Truy vấn catalog dịch vụ qua `/admin/services`.
- Đọc và cập nhật Cấu hình hệ thống qua `/admin/settings`.

### Giai đoạn 2: Trưởng nhóm (Team Leader)

- Đăng nhập và xác thực vai trò `team_leader`.
- Phân quyền nghiêm ngặt (Negative RBAC): Bị chặn 403 Forbidden khi truy cập `/admin/settings`.
- Truy cập danh sách dự án phụ trách qua `/projects`.

### Giai đoạn 3: Chấm công & Kiểm thử biên thời gian (Attendance Boundaries)

- Thực thi câu lệnh kiểm tra biên với giờ làm việc chuẩn:
  - `07:59` -> `late_minutes = 0` (ĐÚNG GIỜ)
  - `08:00` -> `late_minutes = 0` (ĐÚNG GIỜ)
  - `08:05` -> `late_minutes = 0` (TRONG ÂN HẠN 5 PHÚT)
  - `08:06` -> `late_minutes = 6` (ĐI MUỘN)
  - `17:24` -> `early_leave_minutes = 6` (VỀ SỚM)
  - `17:25` -> `early_leave_minutes = 0` (HỢP LỆ)
  - `17:30` -> `early_leave_minutes = 0` (HỢP LỆ)
- Nhân viên thực hiện Check-in API và truy vấn lịch sử chấm công cá nhân thành công (`status=201` & `status=200`).
- _Lưu ý bán kính GPS: LOCAL UAT TEMPORARY VALUE: 100m (Giá trị chính thức trên Production đang PENDING OWNER APPROVAL)._

### Giai đoạn 4: Workflow Engine v1 & Đồng nhất Task Identity

- Tạo Workflow Template qua API: `POST /admin/workflows/templates`.
- Tạo Giai đoạn (Stage) qua API: `POST /admin/workflows/templates/:id/stages`.
- Gán toàn bộ Delivery Items qua API: `POST /admin/workflows/stages/:id/items`.
- Phát hành Template qua API: `POST /admin/workflows/templates/:id/publish`.
- Đặt làm mặc định qua API: `POST /admin/workflows/templates/:id/set-default`.
- Khởi tạo quy trình dự án thực tế và sinh Task chính: Mã Task đồng nhất trên toàn bộ hệ thống.

### Giai đoạn 5: Lưu trữ tệp tin thực tế (Supabase Storage Flow)

- Khởi tạo phiên tải lên: `POST /documents/upload-session`.
- Tải lên tệp PDF nhị phân thực tế vào Supabase Storage bucket `company-documents`.
- Hoàn tất tài liệu và lưu metadata vào DB: `POST /documents/finalize` (Sinh mã tài liệu `TL_...`).
- Sinh URL tải về có chữ ký bảo mật: `GET /documents/:id/download`.
- Tải về và xác minh nội dung dữ liệu nhị phân trùng khớp 100%.
- Xóa tài liệu an toàn: `DELETE /documents/:id`.

### Giai đoạn 6: Chi phí dự án (Expenses API Flow)

- Nhân viên gửi đề xuất chi phí: `POST /expenses` (Sinh mã `CP_...`).
- Kế toán phê duyệt đề xuất: `POST /expenses/:id/review` (action `approved`).
- Kế toán hoàn ứng giải ngân: `POST /expenses/:id/reimburse`.
- Khách hàng bị chặn 403 Forbidden khi cố truy cập phân hệ chi phí.

### Giai đoạn 7: Bảng lương & Phiếu lương (Payroll API Flow)

- Kế toán tạo đợt tính lương: `POST /payroll/runs/generate` (Kỳ lương `2026-08`, tự động tính theo ngày công thực tế).
- Kế toán phê duyệt đợt lương: `POST /payroll/runs/:id/approve`.
- Kế toán xác nhận hoàn tất chi trả: `POST /payroll/runs/:id/pay`.
- Nhân viên tra cứu phiếu lương cá nhân thành công qua `/payroll/me/payslips`.
- Khách hàng bị chặn 403 Forbidden khi cố truy cập phân hệ bảng lương.

### Giai đoạn 8: Yêu cầu hỗ trợ (Support Ticket API Flow)

- Khách hàng tạo ticket hỗ trợ: `POST /support/tickets` (Sinh mã `YC_...`).
- Trưởng nhóm phản hồi trao đổi qua API: `POST /support/tickets/:id/messages`.

### Giai đoạn 9: Realtime WebSockets Chat

- Kết nối authenticated Socket.IO client với token hợp lệ: **THÀNH CÔNG**.
- Kết nối unauthenticated Socket.IO client: **BỊ TỪ CHỐI & NGẮT KẾT NỐI (PASS)**.

### Giai đoạn 10: Trực tiếp từ chối truy cập DB từ trình duyệt (Fail-Closed Matrix)

Xác nhận lệnh `SELECT` trực tiếp từ các vai trò `anon` và `authenticated` trên toàn bộ 14 bảng backend-only đều trả về lỗi `permission denied` (42501):

1. `workflow_templates`
2. `workflow_template_stages`
3. `workflow_template_stage_items`
4. `project_workflows`
5. `project_workflow_stage_items`
6. `project_expenses`
7. `payroll_runs`
8. `payslips`
9. `company_documents`
10. `support_tickets`
11. `support_ticket_messages`
12. `system_settings`
13. `company_work_calendar_settings`
14. `company_work_calendar_events`

---

## 3. TỔNG HỢP KIỂM THỬ HỒI QUY TỰ ĐỘNG (AUTOMATED TEST MATRIX)

- **API Unit Tests (`apps/api/src/**/*.spec.ts`)**: **501 passed** (59 suites)
- **API E2E Tests (`apps/api/test/**/*.e2e-spec.ts`)**: **94 passed** (9 suites)
- **Web UI Tests (`apps/web/**/*.test.{ts,tsx}`)**: **77 passed** (13 suites)
- **Validation Tests (`packages/validation/index.test.ts`)**: **1 passed** (1 suite)
- **TỔNG SỐ TESTS:** **673 / 673 PASSED (100%)**

---

## 4. AN TOÀN DỮ LIỆU & BẢO VỆ PRODUCTION

- **Production Project Ref:** `umtgfaqjoqbsdzwpqizq`
- **Production Migrations Applied:** **0**
- **Production Synthetic Users Created:** **0**
- **Production Writes:** **0**
- **Trạng thái Production:** **BẢO VỆ NGUYÊN VẸN 100% / UNTOUCHED**
