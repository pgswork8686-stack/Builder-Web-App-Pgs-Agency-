# HƯỚNG DẪN NHANH DÀNH CHO NHÂN VIÊN (QUICK START GUIDE)

_Hệ thống PGS HUB — Dành cho Nhân sự, Trưởng nhóm & Khách hàng_

---

## 1. ĐĂNG NHẬP HỆ THỐNG

![Đăng nhập PGS Hub](screenshots/login.png)

1. Truy cập đường dẫn: `http://localhost:3000/auth/login` (hoặc tên miền chính thức của công ty).
2. Nhập Email và Mật khẩu được cấp.
3. Bấm nút **Đăng nhập** để vào Bàn làm việc tổng quan.

---

## 2. CHẤM CÔNG HÀNG NGÀY (ATTENDANCE)

![Màn hình Chấm công](screenshots/attendance.png)

- **Vị trí**: Menu **Chấm công** (`/app/attendance`).
- **Quy định giờ giấc**:
  - Giờ bắt đầu: `08:00` (Sau `08:05`, từ `08:06` trở đi tính **Đi muộn**).
  - Giờ kết thúc: `17:30` (Trước `17:25`, từ `17:24` trở về trước tính **Về sớm**).
- **Thực hiện**:
  - Bật quyền truy cập định vị khi trình duyệt yêu cầu.
  - Bấm **Check-in** khi đến cơ quan và **Check-out** khi hết giờ làm.

---

## 3. BẢNG ĐIỀU KHIỂN & CÔNG VIỆC TRONG NGÀY (DASHBOARD & TODAY'S WORK)

![Bàn làm việc PGS Hub](screenshots/dashboard.png)

- **Vị trí**: Trang chủ sau đăng nhập (`/app/dashboard` hoặc `/app/admin`).
- Theo dõi các chỉ số KPI, dự án đang tham gia, danh sách việc cần giải quyết trong ngày và thông báo mới nhất.

---

## 4. QUẢN LÝ NHIỆM VỤ & DANH SÁCH CÔNG VIỆC (TASKS)

![Danh sách công việc](screenshots/tasks.png)

- **Vị trí**: Menu **Công việc** (`/app/admin/tasks` hoặc `/app/employee/tasks`).
- Tra cứu danh sách đầu việc, người thực hiện, độ ưu tiên và tiến độ hoàn thành.

---

## 5. CẬP NHẬT TRẠNG THÁI TRÊN BẢNG KANBAN (KANBAN BOARD)

![Bảng Kanban dự án](screenshots/kanban.png)

- **Vị trí**: Menu **Bảng Kanban** (`/app/admin/kanban`).
- Kéo thả các thẻ công việc qua các cột **Cần làm (Todo)** -> **Đang làm (In Progress)** -> **Đang duyệt (Review)** -> **Hoàn thành (Done)**.

---

## 6. THEO DÕI HẠN CHÓT & LỊCH CÔNG TÁC (DEADLINES & CALENDAR)

![Lịch làm việc và Deadlines](screenshots/calendar.png)

- **Vị trí**: Menu **Lịch công việc** (`/app/admin/calendar`).
- Xem trực quan các mốc bàn giao sản phẩm, lịch làm việc luân phiên thứ Bảy và ngày nghỉ lễ của công ty.

---

## 7. QUY TRÌNH DỊCH VỤ CHUẨN HÓA (WORKFLOW ENGINE V1)

![Quy trình công việc chuẩn](screenshots/workflow.png)

- **Vị trí**: Menu **Quy trình** (`/app/admin/workflows`).
- Xem cây quy trình các giai đoạn, từng đầu việc phụ thuộc và duyệt qua cổng nghiệm thu giai đoạn (Approval Gate).

---

## 8. ĐỀ XUẤT CHI PHÍ DỰ ÁN & HOÀN ỨNG (EXPENSES)

![Quản lý Chi phí & Tài chính](screenshots/expenses.png)

- **Vị trí**: Menu **Chi phí / Tài chính** (`/app/admin/finance` hoặc `/app/employee/expenses`).
- Nhập số tiền, phân loại chi phí, đính kèm hóa đơn chứng từ và gửi Kế toán phê duyệt giải ngân.

---

## 9. TẢI LÊN & QUẢN TRỊ TÀI LIỆU CÔNG TY (DOCUMENT UPLOAD)

- **Vị trí**: Menu **Tài liệu** (`/app/admin/documents`).
- Tạo phiên tải lên, tải tệp tin chính sách/hợp đồng vào Supabase Storage an toàn, tra cứu và tải về bằng URL có chữ ký bảo mật.

---

## 10. TRUNG TÂM YÊU CẦU HỖ TRỢ KỸ THUẬT (SUPPORT & CHAT)

![Hỗ trợ & Trao đổi Realtime](screenshots/support.png)

- **Vị trí**: Menu **Trao đổi / Hỗ trợ** (`/app/chat` hoặc `/app/support`).
- Gửi yêu cầu hỗ trợ, thảo luận trực tiếp thời gian thực qua WebSockets và nhận giải đáp từ bộ phận phụ trách.
