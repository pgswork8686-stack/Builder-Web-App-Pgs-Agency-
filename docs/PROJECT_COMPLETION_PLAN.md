# Kế hoạch hoàn thiện PGS Hub

Cập nhật 09/11/2026. Nhánh làm việc: `figma-update` (chưa hợp vào `main`). Hệ thống chạy tại hub.pgsagency.vn / api.pgsagency.vn.

## 1. Hiện trạng (đã kiểm chứng)
**Đã chạy ổn:** hạ tầng VPS + HTTPS, đăng nhập Google, sao lưu hằng ngày, 5 dashboard theo vai trò, khung giao diện sáng theo Figma, màn xác thực, công việc/Kanban thật (Trưởng nhóm, Admin), chấm công vào/tan ca (đã sửa lỗi enum trên production), Việt hóa nhãn.

**Còn dở / rủi ro:**
| # | Vấn đề | Mức |
|---|---|---|
| 1 | Hơn 90 trang con chưa so Figma (đã đổi màu + khung chung, bố cục chưa chuẩn) | Cao |
| 2 | Chưa kiểm thử chức năng theo từng vai trò (mới chạy được Trưởng nhóm); chưa có dữ liệu test | Cao |
| 3 | Mã trên VPS là nhánh `figma-update`, `main` còn bản cũ; production DB lệch migration (đã gặp 1 lần) | Cao |
| 4 | Bảo mật vận hành: mật khẩu root/aaPanel, khóa Supabase secret từng lộ; cổng 22236 mở; SSH còn mật khẩu | Cao |
| 5 | Chưa gửi email (SMTP), chưa có sao lưu schema/auth/Storage, chưa diễn tập khôi phục | Trung bình |
| 6 | Tablet/Mobile chưa làm; trang `/about` đã gỡ (ngoài phạm vi) | Trung bình |
| 7 | Tài liệu theo phòng ban: Admin xong; Trưởng nhóm/Nhân viên chưa | Trung bình |
| 8 | Kanban tổng hợp chưa kéo thả; giải trình chấm công chưa có API | Thấp |

## 2. Kế hoạch theo giai đoạn
### G1 — Ổn định nền (1–2 ngày) · làm ngay
- Đổi mật khẩu root + aaPanel, xoay khóa Supabase secret, giới hạn cổng 22236 theo IP, tắt SSH mật khẩu (đã có khóa).
- Hợp `figma-update` vào `main` sau khi chủ dự án duyệt; sửa `deploy.sh` mặc định theo `main`.
- Đối chiếu toàn bộ migration trong repo với production (liệt kê hàm/bảng lệch), áp bản thiếu bằng migration có số hiệu.
- Gán phòng ban cho tài khoản thật chưa có (ví dụ pgswork8686).

### G2 — Dữ liệu test + kiểm thử theo vai trò (2–3 ngày)
- Tạo bộ dữ liệu mẫu có tiền tố `TEST_` (1 dự án PB_02, vài công việc, 1 hóa đơn, 1 đơn nghỉ phép, 1 ticket) để dọn được bằng một lệnh.
- Kịch bản kiểm thử tay + Playwright cho từng vai trò (xem mục 3).
- Mỗi lỗi: sửa → test → triển khai → chụp xác nhận.

### G3 — Đưa từng trang con về đúng Figma (5–8 ngày)
Thứ tự: Trưởng nhóm (11) → Nhân viên (10) → Kế toán (15) → Khách hàng (11) → Admin (~39) → Dùng chung (9).
Mỗi trang: chụp frame Figma → sửa bố cục/nội dung → xem trên bản chạy → ghi lệch còn lại vào bảng.

### G4 — Bổ sung chức năng còn thiếu (2–3 ngày)
- Tài liệu phòng ban cho Trưởng nhóm/Nhân viên (quy tắc: chỉ thấy phòng mình + toàn công ty).
- Giải trình chấm công (API + giao diện duyệt).
- SMTP gửi email thông báo/OTP; kéo thả Kanban tổng hợp.

### G5 — Tablet/Mobile (3–4 ngày)
Theo trang Figma 06/07; kiểm tra điểm gãy 768 và 390; sidebar dạng ngăn kéo.

### G6 — Vận hành & bàn giao (1–2 ngày)
- Sao lưu schema + Storage + auth, diễn tập khôi phục một lần, ghi runbook.
- Giám sát (health check + cảnh báo), log lỗi, tài liệu người dùng theo vai trò.
- Dọn tài khoản/dữ liệu test, nghiệm thu.

## 3. Ma trận kiểm thử theo vai trò (mỗi ô phải có bằng chứng: ảnh hoặc log)
| Vai trò | Luồng chính cần pass |
|---|---|
| Admin | Duyệt/từ chối tài khoản; gán vai trò + phòng ban; tạo khách/dự án/dịch vụ; cài đặt chấm công; xem 5 dashboard số liệu thật |
| Trưởng nhóm | Dashboard phòng; giao việc mới; duyệt nghỉ phép + kết quả công việc; Kanban; chấm công đội |
| Nhân viên | Nhận việc, đổi trạng thái, nộp kết quả; chấm công vào/tan ca; xin nghỉ phép; báo cáo ngày; phiếu lương |
| Kế toán | Hợp đồng → hóa đơn → ghi nhận thanh toán; công nợ; đề nghị chi; bảng lương |
| Khách hàng | Chỉ thấy công ty mình; duyệt/yêu cầu chỉnh sản phẩm; hóa đơn được phép; ticket hỗ trợ |
| Chéo | Khách A không đọc dữ liệu khách B; nhân viên không vào trang Admin; token hết hạn; vị trí ngoài phạm vi bị chặn |

## 4. Tiêu chí hoàn thành
1. 100% trang của 5 vai trò khớp Figma (bảng so sánh không còn "lệch").
2. Ma trận mục 3 pass trên bản chạy thật, có bằng chứng.
3. `main` = bản đang chạy; migration repo khớp production.
4. Bảo mật mục G1 xong; sao lưu đã diễn tập khôi phục.
5. Không còn nhãn tiếng Anh/dòng lẻ trong giao diện; không có dữ liệu test.

## 5. Quyết định cần chủ dự án
- Duyệt hợp nhánh vào `main` khi nào.
- Cho phép dữ liệu mẫu `TEST_` trên production, hay dựng project Supabase staging riêng (an toàn hơn, thêm ~1 ngày).
- Nội dung thật cho trang công khai (nếu muốn làm lại sau này).
