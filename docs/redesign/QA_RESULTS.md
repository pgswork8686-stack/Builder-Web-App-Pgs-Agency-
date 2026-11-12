# QA RESULTS — PGS Hub V2 (12/11/2026)

Kiểm thử thật trên nhánh `feat/pgs-hub-v2-full-role-redesign` chạy ở localhost, nối API **production** qua proxy chỉ-đọc (mọi thao tác ghi bị chặn). Đăng nhập bằng 4 tài khoản QA tạo trên production theo đúng luồng duyệt (`approve_pending_account`).

## 1. Tài khoản QA

| Tài khoản | Vai trò | Phạm vi | Trạng thái |
|---|---|---|---|
| qa.leader@pgsagency.vn | Trưởng phòng | Phòng của test.leader | Đăng nhập OK, `/auth/me` 200 |
| qa.employee@pgsagency.vn | Nhân viên | Phòng của test.employee | Đăng nhập OK |
| qa.accountant@pgsagency.vn | Kế toán | Phòng của test.accountant | Đăng nhập OK |
| qa.client@pgsagency.vn | Khách hàng | Công ty của test.client | Đăng nhập OK |

Quản trị viên QA: **chưa tạo** — hệ thống cấm cấp quyền admin qua luồng duyệt; cần PGS quyết định. Mật khẩu chỉ lưu ngoài repo. Xóa 4 tài khoản sau khi nghiệm thu.

## 2. Kết quả tự động

| Kiểm tra | Kết quả |
|---|---|
| 100 route web (build production) | 100/100 trả 200, không lỗi render |
| 96 endpoint GET, chưa đăng nhập | 95 trả 401, `/health` 200 |
| 96 endpoint GET × 4 vai trò | 0 lỗi 5xx; 200/403 đúng quyền |
| Test API | 621 + 2 mới, đạt |
| Test web | 95 đạt |
| `next build`, `tsc`, lint toàn web | Đạt (0 lỗi lint, 14 cảnh báo có sẵn) |

## 3. Kết quả theo màn (đăng nhập thật, 56 lượt mở trang)

| Vai trò | Trang mở | Lỗi tìm thấy | Đã sửa |
|---|---|---|---|
| Trưởng phòng | 17 | 4 | 4 (2 phía API chờ deploy) |
| Nhân viên | 13 | 0 | — |
| Kế toán | 15 | 3 | 0 |
| Khách hàng | 11 | 0 | — |

### Lỗi đã sửa (commit `871ebd6`)
- **P1 · Quyền:** Trưởng phòng bị 403 khi xem việc của dự án cùng phòng (Cần xử lý, Công việc, Kanban trống). Sửa `TasksService.getAccess`. **Chờ deploy API** mới có hiệu lực.
- **P2:** Đội nhóm gọi API chỉ dành admin → dùng `/team/members`.
- **P2:** Tin nhắn gọi danh bạ admin → danh bạ theo quyền.
- **P3:** Tab “Chấm công phòng” trỏ sai; chữ “check-in” → “vào ca” (API, chờ deploy); tiêu đề “Cần xử lý”.

### Lỗi còn mở
| Mã | Mức | Màn | Lỗi | Hướng sửa |
|---|---|---|---|---|
| Q1 | **P1 nghiệp vụ** | Kế toán › Chấm công & Nghỉ phép | `/app/attendance`, `/app/leave` đẩy Kế toán về trang tổng quan → Kế toán **không chấm công/xin nghỉ được** (trái nghiệp vụ K15/K16) | Mở guard route cho `accountant`, kiểm API check-in cho phép accountant |
| Q2 | P2 | Kế toán › Chi phí dự án | Gọi `/admin/projects` → 403, danh sách dự án để lọc trống | Dùng endpoint dự án theo quyền kế toán |
| Q3 | P2 | Kế toán › Chấm công nhân sự | Gọi `/admin/departments`, `/admin/teams` → 403, bộ lọc phòng trống | Endpoint danh mục phòng cho kế toán |
| Q4 | P3 | Tổng quan Kế toán | Cột biểu đồ tháng không có số liệu còn màu vàng cũ | Đổi sang xám |
| Q5 | P3 | Mọi trang có tab module | Thanh tab nằm **trên** tiêu đề trang | Chuyển tab xuống dưới tiêu đề |
| Q6 | P3 | Nhân viên › Công việc | Nút “Đề xuất công việc” mờ không lý do (chưa thuộc dự án nào) | Thêm dòng giải thích |
| Q7 | P3 | Nhiều trang | Tiêu đề viết hoa không thống nhất (“Quản Lý Lương & Chấm Công PGS”, “Hồ Sơ Cá Nhân”), trang Hóa đơn có tiêu đề “Tài chính dự án” | Chuẩn hóa tiêu đề theo tên menu |

## 4. Chưa kiểm được
- Thao tác ghi (giao việc, duyệt, chấm công, ghi nhận thu): proxy chặn để bảo vệ production.
- Màn Quản trị viên: chưa có tài khoản QA admin.
- Khổ điện thoại/máy tính bảng: chưa chụp.
- Phần sửa phía API (Q đã sửa P1) chưa thấy trên giao diện vì API production chưa deploy.
