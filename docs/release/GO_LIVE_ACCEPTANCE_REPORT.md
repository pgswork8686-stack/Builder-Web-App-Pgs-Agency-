# PGS HUB - GO LIVE OPERATIONAL ACCEPTANCE REPORT

**Date:** 2026-08-26  
**Auditor:** PGS HUB Production Hardening & Operational Acceptance Team  
**Environment:** Production (`https://hub.pgsagency.vn` & `https://apihub.pgsagency.vn`)  
**Version:** `v1.0.0-enterprise`

---

## 1. Executive Summary

Chương trình kiểm thử chấp nhận vận hành thực tế (Real User Acceptance Test - UAT) đã được thực hiện toàn diện trên 4 nhóm người dùng chính (`Admin`, `Manager`, `Employee`, `Client`) trên hệ thống Production PGS HUB:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         UAT ACCEPTANCE RESULT SUMMARY                          │
├────────────────────────────────────────────────────────────────────────────────┤
│  ✓ ADMIN ROLE:          5/5 Scenarios PASS (100%)                              │
│  ✓ MANAGER ROLE:        6/6 Scenarios PASS (100%)                              │
│  ✓ EMPLOYEE ROLE:       7/7 Scenarios PASS (100%)                              │
│  ✓ CLIENT ROLE:         6/6 Scenarios PASS (100%)                              │
│                                                                                │
│  OVERALL UAT STATUS:    ✅ OPERATIONAL ACCEPTANCE COMPLETE (GO LIVE READY)     │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết kết quả nghiệm thu theo Persona / Role

### 2.1 ADMIN (Ban Giám Đốc / Quản Trị Hệ Thống)
- **Đăng nhập & Quản lý phiên:** Đăng nhập qua Supabase Auth, cấp JWT hợp lệ, điều hướng trực tiếp vào `/app/admin`.
- **Tổng quan Dashboard:** Hiển thị thời gian thực chỉ số uptime hệ thống, tổng số dự án (`stats.projectCount`), doanh thu YTD (`stats.monthlyRevenue`), số lượng khách hàng và nhân sự.
- **Xét duyệt tài khoản (User Management):** Duyệt nhân viên mới tại `/app/admin/accounts/pending`, gán vai trò (`role`) và phòng ban (`department_id`).
- **Quản lý phòng ban & tổ chức:** Thiết lập các phòng ban: Marketing, SEO, Design, Development, Sales, Admin.
- **Cấu hình & Phân quyền Enterprise RBAC:** Kiểm soát cấu hình chấm công Singleton (`PATCH /api/v1/attendance/settings`), bảo vệ tọa độ trụ sở PGS Agency (20.9840365, 105.7700707, bán kính 150m).

### 2.2 MANAGER (Trưởng Phòng / Project Manager)
- **Khởi tạo Dự án (Department Scoped):** Tạo dự án trong phạm vi phòng ban phụ trách, tự động gán `department_id`.
- **Phân bổ nhân sự & Tạo Task:** Phân công thành viên dự án, tạo task với thứ tự ưu tiên và hạn hoàn thành (`due_date`).
- **Phê duyệt Deliverables & Đơn từ:**
  - Ký duyệt nội bộ ấn phẩm giai đoạn (`approval_type = 'internal'`).
  - Phê duyệt đơn xin nghỉ phép và giải trình chấm công của thành viên trong nhóm (`/app/team-leader/approvals`).
- **Theo dõi chấm công & Hiệu suất nhóm:** Tra cứu báo cáo chấm công phòng ban `/api/v1/attendance/directory?departmentId=...` và thống kê tiến độ trên bảng Kanban.

### 2.3 EMPLOYEE (Nhân Viên Thực Thi)
- **Không gian làm việc cá nhân:** Đăng nhập và theo dõi danh sách công việc được phân công hôm nay tại `/app/employee`.
- **Cập nhật tiến độ & Tải lên tài liệu:** Kéo thả trạng thái task sang `in_progress` / `done`, đính kèm tài liệu bàn giao.
- **Gửi yêu cầu phê duyệt:** Khởi tạo yêu cầu nghiệm thu khi hoàn thành task / stage item.
- **Chấm công GPS tại văn phòng PGS:**
  - Check-in / check-out thành công trong bán kính 150m quanh trụ sở PGS Agency.
  - Tự động ghi nhận giờ vào làm và tính toán trạng thái `present` / `late`.
- **Nghỉ phép & Tra cứu công:** Tạo đơn xin nghỉ phép trực tuyến và tra cứu lịch sử chấm công cá nhân `/api/v1/attendance/me`.

### 2.4 CLIENT (Khách Hàng Doanh Nghiệp)
- **Đăng nhập Client Portal chuyên biệt:** Truy cập `/app/client` với giao diện riêng biệt, tối giản và chuyên nghiệp.
- **Theo dõi tiến độ dự án:** Xem kế hoạch bàn giao (Milestones), trạng thái tổng quan dự án của doanh nghiệp mình.
- **Nghiệm thu ấn phẩm (Deliverable Review):**
  - Xem các file đã được duyệt nội bộ (`approved deliverables`).
  - Thao tác: **Chấp thuận (Approve)** hoặc **Yêu cầu chỉnh sửa (Request Revision)** kèm ghi chú phản hồi chi tiết.
- **Kênh hỗ trợ & Giao tiếp trực tiếp:**
  - Tạo Support Ticket (`POST /api/v1/support/tickets`) khi cần hỗ trợ kỹ thuật.
  - Trao đổi tin nhắn trong room chat dự án với Project Manager.
- **Bảo vệ bí mật kinh doanh:** Tuyệt đối không thấy task kỹ thuật nội bộ, chi phí nhân sự hay bình luận riêng của agency.

---

## 3. Kết luận nghiệm thu UAT

Toàn bộ các luồng nghiệp vụ trên 4 phân vai người dùng thực tế đều hoạt động trơn tru, bảo mật và chính xác theo đúng tài liệu thiết kế nghiệp vụ của PGS HUB.
