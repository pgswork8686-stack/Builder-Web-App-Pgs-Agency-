# Kế hoạch chuyển giao diện sang Figma mới

Nguồn thiết kế: Figma `Thiết Kế WebsiteApp PGS` (fileKey `wjMjtxfqT7Jot06fCojjGJ`), trang `05 Giao diện Desktop` (114 frame), `06 Tablet`, `07 Mobile`.
Cập nhật: 06/11/2026. Nhánh làm việc: `figma-update` (không đụng `main` cho đến khi duyệt).

## Hiện trạng đã đo
- Token màu app (`PGS Hub App`: vàng `#e7ae18`, navy `#161827`) **khớp** repo. Khác: nền trang `#fffbf0`, viền `#f2ead3`, nền nhạt `#fff8e5`/`#fbf3dc` (repo dùng xám xanh `#f8fafc`/`#edf2f7`).
- Các route đã có đủ cho hầu hết 114 frame; khác biệt chủ yếu ở **nội dung và bố cục từng trang**.
- **Chưa có trong repo:** trang công khai "Về chúng tôi" (13 khối, dùng bộ token riêng `PGS Tokens`: nền `#fbfbf5`, CTA `#f7d327`, font Inter).
- Admin Dashboard mới (6 ô KPI màu, 2 banner, 8 widget) cần dữ liệu **toàn công ty** mà API hiện chưa có (xem "Khoảng trống backend").

## Giai đoạn
| # | Việc | Trạng thái |
|---|---|---|
| 0 | Hạ tầng VPS, HTTPS, Supabase, đăng nhập Google, sao lưu | Xong |
| 1a | Đồng bộ nền/viền (`#FFFBF0`, `#F2EAD3`) toàn app + tên mục menu admin theo Figma | Xong (nhánh này) |
| 1c | **Khung chung đổi sang thanh bên TRẮNG** (Figma: nền `#fff`, viền `#f2ead3`, mục đang chọn `#fdf1c7` viền `#e7ae18`; bản chạy: navy tối) + header trắng 78px | Xong (thanh bên desktop + di động, tên tiêu đề topbar) |
| 1b | Endpoint `GET /api/v1/admin/dashboard` + dựng lại Admin Dashboard theo Figma | Xong (đã triển khai; kiểm tra endpoint với dữ liệu thật OK, chưa xem trực quan bằng tài khoản admin) |
| 2 | ~~Trang công khai `/about`~~ | Đã gỡ theo yêu cầu: không thuộc phạm vi (chỉ chuyển các màn của 5 vai trò) |
| 3 | Tài liệu theo phòng ban: Admin + Nhân viên + modal tải lên | Admin xong (cột phòng ban, lọc theo phòng, chọn phòng khi tải lên). Nhân viên/Trưởng nhóm chưa |
| 4 | Dashboard các vai trò: Trưởng nhóm, Nhân viên, Kế toán, Khách hàng | Xong 4/4 màn tổng quan (endpoint + giao diện, đã triển khai). Còn lại ~42 màn con của 4 vai trò |
| 5 | Màn Admin còn lại (~39) và nhóm Dùng chung (9) | Chưa làm |
| 6 | Modal phản hồi nghiệm thu của khách (2) | Chưa làm |
| 7 | Responsive Tablet/Mobile theo trang 06/07 | Chưa làm |
| 8 | Rà soát từng màn so ảnh Figma, sửa lệch | Chưa làm |

## Khoảng trống backend (cho Giai đoạn 1b)
Ô/Widget trên Admin Dashboard → dữ liệu cần → API hiện có?
- Dự án đang chạy, Tiến độ dự án → `projectsApi.getAdminProjects` → **có**
- Chờ xử lý (tài khoản chờ duyệt) → `getPendingUsers` → **có**
- Phải thu quá hạn, Doanh thu 6 tháng → `financeApi.getSummary` chỉ có `total_revenue_ytd` → **thiếu** (cần theo tháng + công nợ quá hạn)
- Phiếu hỗ trợ mở → `fetchSupportTickets` → **có** (đếm theo trạng thái)
- Nhân sự có mặt / đi muộn / nghỉ → `attendanceApi.getSummary` chỉ của **cá nhân** → **thiếu** (cần tổng hợp toàn công ty theo ngày)
- Task quá hạn, Công việc mới giao, Phân bổ công việc theo phòng ban → chỉ có danh sách theo từng dự án → **thiếu** (cần tổng hợp toàn công ty)
- Hoạt động gần đây → **thiếu** (cần nguồn nhật ký hoạt động)
- Lịch hôm nay/tuần → `leaveApi.getCalendar`, `work-calendar` → **một phần**

## Quy trình mỗi màn
1. Chụp frame Figma, trích kích thước/màu/chữ. 2. Sửa component hoặc trang. 3. `pnpm --filter web typecheck` + `vitest`. 4. Triển khai nhánh lên VPS (`deploy.sh`). 5. So ảnh thật với Figma và ghi lệch vào bảng trên.

## Đã đồng bộ toàn app (06–09/11)
- Component dùng chung (Button, Badge, Input, Select, Card) khớp thông số Figma trang `04 Thành phần`.
- Màu: nền `#FFFBF0`, viền `#F2EAD3`, viền ô nhập `#E8DDB8`, nền nhạt `#FBF3DC`, chữ chính `#161827` (thay ở ~130 file).
- 5 endpoint dashboard theo vai trò (admin, team-leader, employee, accountant, client). Khách hàng cách ly theo client_memberships và chỉ hóa đơn client_visible.
- Test: API 68 bộ / 620 test, web 16 bộ / 92 test đạt.
