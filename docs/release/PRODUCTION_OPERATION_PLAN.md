# PGS HUB - FIRST 14 DAYS PRODUCTION OPERATION PLAN

**Date:** 2026-08-26  
**Auditor:** PGS HUB Operations & Engineering Lead  
**Scope:** Giám sát vận hành 14 ngày đầu sau khi Go-Live, xử lý sự cố, hỗ trợ người dùng và đánh giá hiệu năng

---

## 1. Mục tiêu vận hành (Operational Objectives)

- Đảm bảo tính khả dụng (Uptime) $\ge 99.9\%$ cho cả Backend API (`https://apihub.pgsagency.vn`) và Web App (`https://hub.pgsagency.vn`).
- Hỗ trợ nhanh chóng toàn bộ nhân sự công ty PGS Agency (Marketing, SEO, Design, Dev, Sales, Admin) làm quen với hệ thống ERP mới.
- Phát hiện và xử lý sự cố phát sinh trong vòng tối đa 15 phút.

---

## 2. Lịch trình công việc hàng ngày (Daily Operational Routine)

| Khung giờ | Hạng mục công việc | Người phụ trách | Hành động thực hiện |
|---|---|---|---|
| **08:15 - 08:45** | **Kiểm tra Chấm công GPS buổi sáng** | HR / Admin | - Giám sát luồng check-in GPS tại trụ sở PGS Agency.<br>- Tiếp nhận và duyệt các yêu cầu điều chỉnh công nếu có nhân viên gặp lỗi mạng. |
| **11:30 - 12:00** | **Kiểm tra Error Logs & Health API** | DevOps / Tech Lead | - Kiểm tra `/health` và log lỗi HTTP 5xx trên cPanel Passenger.<br>- Kiểm tra số lượng kết nối connection pool trên Supabase. |
| **14:00 - 14:30** | **Kiểm tra Tiến độ Dự án & Phê duyệt** | Project Managers | - Theo dõi tiến độ task trên Kanban board.<br>- Rà soát các ấn phẩm bàn giao đang chờ Client phê duyệt (`/app/client/approvals`). |
| **17:30 - 18:00** | **Kiểm tra Chấm công buổi chiều & Backup** | HR / DevOps | - Giám sát luồng check-out.<br>- Xác nhận snapshot backup tự động của database đã hoàn tất thành công. |

---

## 3. Lịch trình đánh giá hàng tuần (Weekly Operational Review)

### Tuần 1 (Ngày 1 - 7):
1. **Thu thập phản hồi người dùng:** Tổ chức phiên lắng nghe ý kiến nhanh từ các trưởng bộ phận về trải nghiệm phân công task, chấm công và duyệt nghỉ phép.
2. **Kiểm toán bảo mật & Truy cập:** Rà soát nhật ký đăng nhập, phát hiện các nỗ lực truy cập trái phép bị chặn bởi `RolesGuard` hoặc `ScopeGuard`.
3. **Đánh giá hiệu năng API:** Đo đạc P95 latency của các endpoint thống kê dashboard và danh sách task.

### Tuần 2 (Ngày 8 - 14):
1. **Kiểm tra tính lương & Chấm công tháng:** Chạy thử nghiệm quy trình tổng hợp công tháng qua `/api/v1/attendance/summary` để chuẩn bị cho kỳ tính lương.
2. **Khách hàng nghiệm thu & Support Ticket:** Đánh giá độ hài lòng của khách hàng khi sử dụng Client Portal (`/app/client`).
3. **Tối ưu hóa tài nguyên:** Điều chỉnh lại giới hạn Rate Limit (`throttleLimit`, `throttleTtl`) nếu có nhu cầu tăng tải.

---

## 4. Quy trình báo cáo và xử lý sự cố (Incident Escalation Protocol)

```
[Phát hiện sự cố] (User Report / Sentry / Uptime Monitor)
       │
       ▼
[Phân loại mức độ]
       ├── P1 (Critical - Hệ thống ngừng trệ): Khắc phục trong ≤ 15 phút.
       ├── P2 (High - Tính năng chính bị lỗi): Khắc phục trong ≤ 1 giờ.
       └── P3 (Low - Lỗi giao diện nhỏ): Khắc phục trong vòng 24 giờ.
       │
       ▼
[Thông báo & Xử lý] -> [Rollback / Hotfix] -> [Post-Mortem Report]
```
