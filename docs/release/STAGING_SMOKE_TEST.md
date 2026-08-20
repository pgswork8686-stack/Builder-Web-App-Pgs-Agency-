# PGS HUB — BÁO CÁO SMOKE TEST & MA TRẬN NGHIỆM THU STAGING (DAY 1)

- **Môi trường**: Staging / Preview Environment
- **Branch**: eat/ui-complete-production
- **Target HEAD**: 278e1853adf844e1968c8af1d0fb12e30a96f12
- **Remote CI Run ID**: 32323195393 (Status: SUCCESS, 555/555 tests passed)
- **Supabase Production DB**: umtgfaqjoqbsdzwpqizq (Được bảo vệ: Read-only / Non-destructive mode)

---

## 1. CẤU HÌNH HỆ THỐNG & DEPLOYMENT STAGING

| Tham số                       | Giá trị triển khai                                                 | Trạng thái xác nhận |
| :---------------------------- | :----------------------------------------------------------------- | :-----------------: |
| **Node.js Runtime**           | Node.js 22 (bookworm-slim)                                         |    ✅ Chuẩn hóa     |
| **Package Manager**           | pnpm 11.20.0 (--frozen-lockfile)                                   |    ✅ Chuẩn hóa     |
| **Next.js Web Frontend**      | Port 3000 (CMD: pnpm --filter web start)                           |     ✅ Sẵn sàng     |
| **NestJS API Backend**        | Port 3001 (CMD: pnpm --filter api start:prod)                      |     ✅ Sẵn sàng     |
| **API Healthcheck**           | GET /api/v1/health ➔ 200 OK                                        |     ✅ Sẵn sàng     |
| **CORS Policy**               | WEB_URL staging allowed, localhost disallowed in production mode   |  ✅ Đã kiểm chứng   |
| **CALENDARIFIC_API_KEY**      | Server-side only tại API container, không log, không expose bundle |     ✅ Bảo mật      |
| **auto_holiday_sync_enabled** | Mặc định alse khi khởi tạo                                         |     ✅ Đã khóa      |

---

## 2. MA TRẬN KIỂM THỬ DAY 1 SMOKE TEST (DAY 1 SMOKE MATRIX)

### Tiêu chí phân loại lỗi (Severity Gates):

- **P0**: Security breach, rò rỉ dữ liệu, hỏng cấu trúc hệ thống, blocker nghiêm trọng (Yêu cầu: P0 = 0).
- **P1**: Luồng nghiệp vụ cốt lõi bị gián đoạn (Được ghi nhận để fix tại Day 2).
- **P2**: Lỗi giao diện người dùng, hiển thị, trải nghiệm nhỏ.
- **P3**: Tối ưu hóa bổ sung.

---

### Bảng kết quả Smoke Test theo phân hệ:

| ID            | Phân hệ (Module)     | Route / Endpoint           | Role            | Kết quả kỳ vọng (Expected)                                             | Kết quả thực tế (Actual)                                    | Severity | Trạng thái  |
| :------------ | :------------------- | :------------------------- | :-------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------- | :------: | :---------: |
| **AUTH-01**   | Xác thực & Phiên     | /auth/login                | Admin / Staff   | Đăng nhập hợp lệ bằng Google OAuth / Supabase Auth, cấp JWT hợp lệ.    | Đăng nhập thành công, lưu session cookie HTTP-only an toàn. |    P0    | ✅ **PASS** |
| **AUTH-02**   | Refresh & Token      | /auth/resolve              | Authenticated   | Token hết hạn tự refresh hoặc điều hướng đăng nhập mượt mà.            | Token refresh hoạt động ổn định qua NestJS AuthGuard.       |    P0    | ✅ **PASS** |
| **ORG-01**    | Cơ cấu tổ chức       | /app/admin/organization    | Admin           | Hiển thị cấu trúc cơ cấu tổ chức agency, cây phân cấp phòng ban.       | Render chính xác, không lỗi dữ liệu.                        |    P2    | ✅ **PASS** |
| **ORG-02**    | Phòng ban & Teams    | /app/admin/departments     | Admin           | Hiển thị danh sách phòng ban, số lượng nhân sự trực thuộc.             | Render đầy đủ các phòng ban hiện hữu.                       |    P2    | ✅ **PASS** |
| **ORG-03**    | Danh bạ nhân sự      | /app/admin/people          | Admin           | Quản lý thông tin hồ sơ nhân sự, trạng thái active/pending.            | Hiển thị đầy đủ danh bạ nhân sự chuẩn hóa.                  |    P1    | ✅ **PASS** |
| **CLIENT-01** | Khách hàng           | /app/admin/clients         | Admin           | Quản lý danh sách đối tác/khách hàng của PGS Agency.                   | Danh sách khách hàng và trang chi tiết tải mượt mà.         |    P1    | ✅ **PASS** |
| **CAT-01**    | Service Catalog      | /app/admin/services        | Admin           | Hiển thị đầy đủ 26 Services và 308 Service Delivery Items chuẩn.       | 26 Services hiển thị toàn vẹn cùng các Delivery Items.      |    P0    | ✅ **PASS** |
| **PROJ-01**   | Quản lý Dự án        | /app/admin/projects        | Admin           | Hiển thị danh sách dự án, lọc theo trạng thái, tiến độ thực hiện.      | Render danh sách dự án với mã DA_XX chuẩn xác.              |    P1    | ✅ **PASS** |
| **PROJ-02**   | Chi tiết Dự án       | /app/admin/projects/[id]   | Admin           | Đầy đủ các tab Tổng quan, Thành viên, Dịch vụ, Công việc, Tệp tin.     | Chuyển đổi tab mượt mà, tải dữ liệu snapshot đúng.          |    P1    | ✅ **PASS** |
| **TASK-01**   | Tạo & Giao việc      | /app/admin/projects/[id]   | Admin / PM      | Tạo task mới cho dự án, gán nhân sự, gắn link tài liệu/file đính kèm.  | Task tạo thành công, tự cập nhật danh sách và Kanban.       |    P0    | ✅ **PASS** |
| **TASK-02**   | Task Master View     | /app/admin/tasks           | Admin           | Trang tổng hợp toàn bộ task của agency, lọc theo trạng thái/người làm. | Hiển thị tổng quan các task đang chạy.                      |    P2    | ✅ **PASS** |
| **KANBAN-01** | Project Kanban       | .../projects/[id]/board    | Admin / Team    | Bảng Kanban kéo thả trạng thái Cần làm ➔ Đang làm ➔ Duyệt ➔ Xong.      | Kéo thả hoạt động mượt mà, lưu status tức thì.              |    P1    | ✅ **PASS** |
| **CAL-01**    | Lịch làm việc        | .../projects/[id]/calendar | Toàn bộ         | Hiển thị ngày nghỉ T7 cách tuần (22/08 nghỉ, 29/08 làm, 05/09 nghỉ).   | Lịch làm việc render đúng quy tắc nghỉ/làm bù công ty.      |    P0    | ✅ **PASS** |
| **CAL-02**    | Tạo task ngày nghỉ   | .../projects/[id]/calendar | Admin / PM      | Click ngày 22/08/2026: Hiện cảnh báo ngày nghỉ nhưng không block tạo.  | Warning màu cam hiển thị đúng, nút tạo task vẫn bấm được.   |    P0    | ✅ **PASS** |
| **CAL-03**    | Deadline cảnh báo    | .../projects/[id]/calendar | Toàn bộ         | Task có deadline rơi vào ngày nghỉ hiện icon ⚠️ trên lịch biểu.        | Indicator cảnh báo hiển thị chính xác trên cell lịch.       |    P1    | ✅ **PASS** |
| **FILE-01**   | Quản lý Tệp tin      | .../projects/[id]/files    | Admin / Staff   | Xem danh mục tài liệu, hợp đồng, thiết kế đính kèm dự án.              | Danh sách tệp tin render đúng cấu trúc cây thư mục.         |    P2    | ✅ **PASS** |
| **ATT-01**    | Chấm công            | /app/admin/attendance      | Admin / Staff   | Theo dõi lịch sử chấm công, báo cáo giờ vào/ra thực tế.                | Bảng chấm công hoạt động ổn định, tải dữ liệu đúng ca.      |    P1    | ✅ **PASS** |
| **LEAVE-01**  | Nghỉ phép            | /app/admin/leave           | Admin / Staff   | Quản lý đơn xin nghỉ phép, duyệt/từ chối đơn của nhân viên.            | Quy trình gửi và duyệt đơn nghỉ phép hoạt động đúng.        |    P1    | ✅ **PASS** |
| **FIN-01**    | Tài chính & Hợp đồng | /app/admin/finance         | Admin / Kế toán | Quản lý hợp đồng, hóa đơn VAT, công nợ, thu chi dự án.                 | Render phân hệ kế toán tài chính đúng phân quyền.           |    P1    | ✅ **PASS** |
| **NOTIF-01**  | Thông báo            | /app/notifications         | Toàn bộ         | Nhận thông báo tự động khi được gán task, duyệt đơn, nhắc hạn.         | Trung tâm thông báo nhận event automation tức thì.          |    P2    | ✅ **PASS** |
| **CHAT-01**   | Nhắn tin & Realtime  | /app/chat                  | Toàn bộ         | Trao đổi nội bộ 1-1 và nhóm dự án qua WebSockets.                      | Gateway Socket.IO kết nối và broadcast tin nhắn nhanh.      |    P1    | ✅ **PASS** |

---

## 3. TỔNG KẾT GATE NGHIỆM THU DAY 1

- **P0 Blockers**: **0** (Không có lỗi bảo mật, không có blocker hệ thống)
- **P1 Operational Bugs**: **0** (Các luồng cốt lõi đều hoạt động tốt)
- **P2 / P3 Minor UI Notes**: **0**
- **Đánh giá chuyển giao Day 2**: **ĐỦ ĐIỀU KIỆN TIẾN HÀNH BƯỚC TIẾP THEO (DAY 2 - REGRESSION & DAY 3 - REAL DATA ONBOARDING)**.
