# HƯỚNG DẪN NHANH DÀNH CHO NHÂN VIÊN (QUICK START GUIDE)
*Hệ thống PGS HUB — Dành cho Nhân sự & Thành viên dự án*

---

## 1. ĐĂNG NHẬP HỆ THỐNG
1. Truy cập đường dẫn PGS Hub: `http://localhost:3000/auth/login` (hoặc tên miền chính thức của công ty).
2. Nhập Email công ty và Mật khẩu được cấp.
3. Chọn **Đăng nhập** để vào Trang tổng quan làm việc.

---

## 2. CHẤM CÔNG HÀNG NGÀY (ATTENDANCE)
- **Truy cập**: Mục **Chấm công** trên thanh điều hướng bên trái hoặc vào `/app/attendance`.
- **Quy tắc thời gian**:
  - Giờ bắt đầu làm việc: `08:00`.
  - Bạn được ân hạn 5 phút. **Sau 08:05 (từ 08:06 trở đi)**, hệ thống sẽ tính là **Đi muộn**.
  - Giờ kết thúc làm việc: `17:30`.
  - Bạn được ân hạn 5 phút. **Trước 17:25 (từ 17:24 trở về trước)**, hệ thống sẽ tính là **Về sớm**.
- **Thực hiện**:
  - Bật định vị trình duyệt khi được yêu cầu (Văn phòng: Tầng 2, DM 2-25 Vạn Phúc, Hà Đông).
  - Bấm nút **Check-in** vào đầu buổi sáng.
  - Bấm nút **Check-out** khi kết thúc ngày làm việc.

---

## 3. QUẢN LÝ CÔNG VIỆC TRÊN BẢNG KANBAN
- **Truy cập**: Mục **Công việc của tôi** hoặc **Dự án -> Bảng Kanban**.
- **Thao tác**:
  - Kéo thả thẻ công việc từ cột **Cần làm (Todo)** sang **Đang làm (In Progress)** khi bắt đầu làm.
  - Kéo sang **Đang duyệt (Review)** khi hoàn thành để Trưởng nhóm/Quản trị viên kiểm tra.
  - Đính kèm tệp tin sản phẩm hoặc tài liệu liên quan trực tiếp vào thẻ công việc.

---

## 4. GỬI ĐỀ XUẤT CHI PHÍ DỰ ÁN (EXPENSES)
- **Truy cập**: Mục **Chi phí** trong Dự án hoặc `/app/employee/expenses`.
- **Thao tác**:
  1. Bấm **Tạo đề xuất chi phí mới**.
  2. Chọn Dự án tương ứng, nhập số tiền, loại chi phí và nội dung chi.
  3. Đính kèm hóa đơn/biên lai chuyển khoản.
  4. Bấm **Gửi phê duyệt** để chuyển hồ sơ sang Bộ phận Kế toán duyệt.

---

## 5. TRA CỨU PHIẾU LƯƠNG ĐIỆN TỬ
- **Truy cập**: Mục **Bảng lương** hoặc `/app/employee/payroll`.
- **Thao tác**:
  - Chọn kỳ lương muốn xem (VD: Kỳ tháng 08/2026).
  - Hệ thống hiển thị chi tiết: Lương cơ bản, số ngày công thực tế, phụ cấp, các khoản giảm trừ và Lương thực nhận (Net).

---

## 6. GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT
- Khi gặp sự cố kỹ thuật hoặc lỗi hệ thống, gửi yêu cầu nhanh tại mục **Hỗ trợ** để ban quản trị tiếp nhận xử lý trong vòng 15-30 phút.
