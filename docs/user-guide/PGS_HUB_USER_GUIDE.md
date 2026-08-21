# SỔ TAY HƯỚNG DẪN SỬ DỤNG PGS HUB
*Phiên bản: feat/workflow-engine-v1 | Ngày phát hành: 21/08/2026*

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Đăng ký, Phê duyệt & Đăng nhập](#2-đăng-ký-phê-duyệt--đăng-nhập)
3. [Chấm công, Địa điểm GPS & Lịch làm việc](#3-chấm-công-địa-điểm-gps--lịch-làm-việc)
4. [Quản trị Cơ cấu Tổ chức & Nhân sự](#4-quản-trị-cơ-cấu-tổ-chức--nhân-sự)
5. [Quản lý Khách hàng & Công ty Đối tác](#5-quản-lý-khách-hàng--công-ty-đối-tác)
6. [Quản lý Dự án & Phân bổ Nguồn lực](#6-quản-lý-dự-án--phân-bổ-nguồn-lực)
7. [Công việc, Kanban & Lịch biểu Deadline](#7-công-việc-kanban--lịch-biểu-deadline)
8. [Workflow Engine v1 — Quy trình Mẫu & Thực thi](#8-workflow-engine-v1--quy-trình-mẫu--thực-thi)
9. [Quản lý Chi phí Dự án (CP)](#9-quản-lý-chi-phí-dự-án-cp)
10. [Bảng lương & Phiếu lương Điện tử (BL & PL)](#10-bảng-lương--phiếu-lương-điện-tử-bl--pl)
11. [Kho Tài liệu Doanh nghiệp & Storage (TL)](#11-kho-tài-liệu-doanh-nghiệp--storage-tl)
12. [Hỗ trợ Kỹ thuật & Yêu cầu Khách hàng (YC)](#12-hỗ-trợ-kỹ-thuật--yêu-cầu-khách-hàng-yc)
13. [Trò chuyện Nội bộ & Realtime Chat](#13-trò-chuyện-nội-bộ--realtime-chat)
14. [Trung tâm Tự động hóa & Thông báo](#14-trung-tâm-tự-động-hóa--thông-báo)
15. [Cài đặt Hệ thống & Chính sách Doanh nghiệp](#15-cài-đặt-hệ-thống--chính-sách-doanh-nghiệp)
16. [Hướng dẫn theo 5 Phân quyền (Roles Matrix)](#16-hướng-dẫn-theo-5-phân-quyền-roles-matrix)

---

## 1. TỔNG QUAN HỆ THỐNG
PGS HUB là nền tảng quản trị vận hành toàn diện cho Digital Agency, tích hợp quản lý dự án, chấm công GPS, quy trình tự động (Workflow Engine), tài chính - chi phí - bảng lương và cổng tương tác khách hàng thời gian thực.

---

## 2. ĐĂNG KÝ, PHÊ DUYỆT & ĐĂNG NHẬP
- **Đăng ký tài khoản**: Người dùng mới truy cập `/auth/sign-up` để điền email, họ tên, mật khẩu.
- **Trạng thái phê duyệt**: Sau khi đăng ký, tài khoản rơi vào trạng thái `pending`. Quản trị viên (Admin) xem danh sách tại `/app/admin/accounts/pending` để xét duyệt phân quyền (`admin`, `team_leader`, `employee`, `accountant`, `client`).
- **Đăng nhập**: Sử dụng email và mật khẩu tại `/auth/login`.

---

## 3. CHẤM CÔNG, ĐỊA ĐIỂM GPS & LỊCH LÀM VIỆC
### A. Khung Giờ & Quy Định Đi Muộn / Về Sớm
- **Múi giờ**: `Asia/Ho_Chi_Minh`
- **Giờ bắt đầu**: `08:00` (Ân hạn 5 phút -> Tính muộn từ `08:06`)
- **Giờ kết thúc**: `17:30` (Ân hạn 5 phút -> Tính về sớm nếu trước `17:25`)
- **Văn phòng**: Tầng 2, DM 2-25, Điểm TTCN làng nghề dệt lụa Vạn Phúc, Hà Đông, Hà Nội.
- **Bán kính GPS**: 100m.

### B. Lịch Làm Việc Cách Tuần (Alternate Saturdays)
- Các ngày Thứ 2 đến Thứ 6: Đi làm tiêu chuẩn.
- Thứ 7 tuần chẵn: NGHỈ. Thứ 7 tuần lẻ: ĐI LÀM.
- Chủ nhật: Nghỉ cố định.

---

## 4. QUẢN TRỊ CƠ CẤU TỔ CHỨC & NHÂN SỰ
- Quản lý cây phòng ban và đội nhóm tại `/app/admin/organization`.
- Quản lý hồ sơ nhân sự, mã nhân viên, chức danh, hợp đồng tại `/app/admin/people`.

---

## 5. QUẢN LÝ KHÁCH HÀNG & CÔNG TY ĐỐI TÁC
- Quản lý danh mục đối tác khách hàng tại `/app/admin/clients`.
- Tạo tài khoản đại diện khách hàng (`client`) và gắn vào công ty.

---

## 6. QUẢN LÝ DỰ ÁN & PHÂN BỔ NGUỒN LỰC
- Tạo mới dự án kèm mã dự án duy nhất (VD: `DA_01`).
- Gán dịch vụ dự án, chỉ định Quản lý dự án (Project Manager) và thành viên.

---

## 7. CÔNG VIỆC, KANBAN & LỊCH BIỂU DEADLINE
- Bảng Kanban trực quan kéo thả theo trạng thái (`todo`, `in_progress`, `review`, `done`).
- Lịch biểu theo dõi tiến độ và phân phối công việc cho nhân sự.

---

## 8. WORKFLOW ENGINE V1 — QUY TRÌNH MẪU & THỰC THI
- Thiết lập quy trình mẫu theo từng dịch vụ tại `/app/admin/workflows`.
- Tự động sinh danh sách công việc (Primary Tasks) và điều phối phê duyệt giai đoạn đa cấp.
- Task Identity đồng nhất: Task ID của quy trình đồng bộ xuyên suốt Kanban, Lịch và Danh sách công việc.

---

## 9. QUẢN LÝ CHI PHÍ DỰ ÁN (CP)
- Nhân viên gửi đề xuất chi phí kèm hóa đơn/chứng từ tại `/app/employee/expenses`.
- Kế toán xét duyệt, từ chối và quản lý chi tiêu dự án tại `/app/accountant/finance/project-expenses`.

---

## 10. BẢNG LƯƠNG & PHIẾU LƯƠNG ĐIỆN TỬ (BL & PL)
- Kế toán tạo kỳ lương (`BL_01`), nhập chỉ số ngày công và phê duyệt tại `/app/accountant/payroll`.
- Nhân viên tra cứu phiếu lương cá nhân an toàn, bảo mật tại `/app/employee/payroll`.

---

## 11. KHO TÀI LIỆU DOANH NGHIỆP & STORAGE (TL)
- Quản trị văn bản, tài liệu, quy chế công ty có mã lưu trữ `TL_01`.
- Bảo mật đường dẫn tải xuống qua URL ký số tạm thời (Signed URL).

---

## 12. HỖ TRỢ KỸ THUẬT & YÊU CẦU KHÁCH HÀNG (YC)
- Khách hàng tạo phiếu yêu cầu hỗ trợ `YC_01` trực tiếp tại `/app/client/support`.
- Đội ngũ kỹ thuật tiếp nhận, trao đổi và xử lý theo SLA.

---

## 13. TRÒ CHUYỆN NỘI BỘ & REALTIME CHAT
- Kênh chat nhóm theo dự án và trò chuyện trực tiếp 1-1.
- Hiển thị trạng thái đang soạn tin (typing) và tin nhắn cập nhật tức thời qua WebSockets.

---

## 14. TRUNG TÂM TỰ ĐỘNG HÓA & THÔNG BÁO
- Hệ thống gửi thông báo tự động khi có task mới, yêu cầu duyệt chi phí hoặc duyệt giai đoạn.

---

## 15. CÀI ĐẶT HỆ THỐNG & CHÍNH SÁCH DOANH NGHIỆP
- Quản trị cấu hình ngày lễ, giờ làm việc và quy tắc chấm công toàn công ty tại `/app/admin/settings`.

---

## 16. HƯỚNG DẪN THEO 5 PHÂN QUYỀN (ROLES MATRIX)

### 1. Quản Trị Viên (Admin)
- Toàn quyền cấu hình hệ thống, duyệt tài khoản, quản trị dự án, duyệt quy trình mẫu và cài đặt ngày công.
- Truy cập menu Quản Trị: `/app/admin/*`.

### 2. Trưởng Nhóm (Team Leader)
- Quản lý tiến độ dự án được phân công, điều phối task thành viên, duyệt báo cáo và phản hồi hỗ trợ khách hàng.
- Truy cập menu Trưởng Nhóm: `/app/team-leader/*`.

### 3. Nhân Viên (Employee)
- Thực hiện chấm công GPS hàng ngày, nhận nhiệm vụ trên Kanban, cập nhật tiến độ công việc, gửi đề xuất chi phí và xem phiếu lương.
- Truy cập menu Nhân Viên: `/app/employee/*` & `/app/attendance`.

### 4. Kế Toán (Accountant)
- Quản lý hóa đơn, thanh toán, duyệt chi phí dự án, tính lương và phát hành phiếu lương.
- Truy cập menu Kế Toán: `/app/accountant/*`.

### 5. Khách Hàng (Client)
- Xem tiến độ dự án của doanh nghiệp mình, duyệt bàn giao sản phẩm/dịch vụ, gửi yêu cầu hỗ trợ (Support Ticket).
- Truy cập menu Khách Hàng: `/app/client/*`.
