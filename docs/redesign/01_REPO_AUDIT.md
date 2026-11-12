# 01 · REPO AUDIT — PGS Hub V2

## 1. Baseline

| Mục | Giá trị |
|---|---|
| Repo | `pgswork8686-stack/Builder-Web-App-Pgs-Agency-` |
| Nhánh baseline | `figma-update` @ `fddab405df625f37d078efabd0e81f00882d9cea` (12/11/2026) — trùng với remote, đang chạy trên VPS hub.pgsagency.vn |
| So với `main` | `figma-update` đi trước 43 commit, không thiếu commit nào của `main` (`main` @ `a07b74e`, 29/08/2026) |
| Nhánh làm việc | `feat/pgs-hub-v2-full-role-redesign` tạo từ baseline trên |
| Stack | `apps/web` Next.js 16 + React + TypeScript + Tailwind v4 · `apps/api` NestJS 11 · Supabase Postgres (`supabase/migrations`) · pnpm monorepo |
| Thay đổi chưa commit trên baseline | Không có |

## 2. Số liệu kiểm kê (script `inventory.js`, chạy trên nhánh làm việc)

| Hạng mục | Số lượng |
|---|---:|
| `page.tsx` (route web) | 100 |
| Mục menu trong `role-navigation.ts` | 70 |
| Controller API | 33 |
| Endpoint API | 222 |
| Bảng DB | 69 |
| Migration | 67 |

- **Menu trỏ tới route không tồn tại:** 0.
- **Route không có đường vào từ menu:** 21. Gồm các trang auth/account (hợp lệ) và các trang trùng chức năng: `/app/admin/kanban`, `/app/admin/calendar`, `/app/team-leader/kanban`, `/app/team-leader/calendar`, `/app/team-leader/attendance`, `/app/admin/finance/contracts|invoices` (trùng với accountant), `/app/admin/projects/completed`, `/app/admin/workflows`, `/app/admin/settings/work-calendar`, `/app/profile`, `/app/projects`.
- **Trang bọc mỏng (< 25 dòng):** 39 trang. Phần lớn là trang dùng chung component (phase3 project workspace, phase6 finance), nên không phải trang trống.

Chi tiết từng route nằm ở `02_ROLE_SCREEN_INVENTORY.csv`. Endpoint, lời gọi API và danh sách bảng nằm ở `06_DATA_CONTRACT_MATRIX.md`.

## 3. Phát hiện nghiệp vụ có bằng chứng trong code

| Mã | Phát hiện | Bằng chứng |
|---|---|---|
| CX01 | Bán kính chấm công **150 m**, baseline PGS là **50 m** | `20260826024721_production_audit_hardening.sql` (`location_radius_meters = 150`), `20260820134000_system_settings_v1.sql` (`radius_meters: 150`) |
| CX02 | **Không có WFH** ở DB, API và UI | Tìm `wfh` / `work_from_home` / `remote_work` trong migrations và `apps/api/src`: 0 kết quả. `attendance_policy.allow_remote: true` chỉ là cờ, không có luồng duyệt |
| CX03 | **Không có phiên bản sản phẩm, công khai, nghiệm thu khách.** Chữ `published` chỉ dùng cho mẫu workflow. Việc chỉ có `todo / in_progress / review / done / cancelled` + `approval_status` (đề xuất) | `workflow_engine_v1_foundation.sql` dòng 26–35. `tasks.service.ts` |
| CX08 | Lương dùng **số ngày công chuẩn từ lịch làm việc**, không cố định 24 công | `apps/api/src/payroll/payroll.service.ts` dòng 442 và 704 (`standard_working_days`) |
| OK | Đề xuất việc của Nhân viên → Trưởng phòng duyệt/từ chối có lý do: **đã có runtime** (cột `approval_status`, endpoint `POST tasks/:id/approval`) | migration `20261112000000_task_proposal_approval.sql`, đã kiểm tra trực tiếp trên hub ngày 12/11 |
| OK | Trưởng phòng tạo dự án không chờ Quản trị viên | `projects.controller.ts` cho phép `team_leader` |
| D01 | Trưởng phòng tạo khách CRM đang **mở** (D01 chưa duyệt) | `clients.controller.ts` POST cho `admin, team_leader` |
| OK | Có sổ phép (`leave_balances`, `leave_balance_adjustments`) | migration phase5 |

## 4. Kiến trúc quyền

- Truy cập dữ liệu chủ yếu qua API NestJS. API dùng service key và kiểm tra quyền trong service (`@Roles`, kiểm tra phạm vi phòng/dự án).
- RLS được bật trên 88 lệnh, nhưng chỉ có 6 `create policy` trong migration. Vì vậy **chốt an toàn chính là tầng API**, không phải RLS. Các thay đổi UI ở V2 không được gọi Supabase trực tiếp từ trình duyệt để đọc dữ liệu nghiệp vụ.

## 5. Xác minh dữ liệu thực

| Mức | Phạm vi |
|---|---|
| LIVE VERIFIED (12/11/2026, tài khoản `test.*`) | Đề xuất → duyệt/từ chối việc · Trưởng phòng tạo khách/dự án/thêm thành viên · khách chỉ thấy công ty mình · kế toán xem khách · bảng chấm công có tên |
| API CONTRACT VERIFIED | Toàn bộ 222 endpoint (đọc code) |
| LIVE DATA NOT VERIFIED | Lương, payslip, hợp đồng/hóa đơn ghi mới, chat realtime, tự động hóa |
