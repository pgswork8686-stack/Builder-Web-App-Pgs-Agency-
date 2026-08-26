# PGS HUB - PHASE 8 CUSTOMER PORTAL & MULTI-TENANT CLIENT EXPERIENCE REPORT

**Date:** 2026-08-26  
**Auditor:** PGS HUB Production Hardening Team  
**Scope:** Client Portal (`/app/client/*`), Strict Multi-Tenant Isolation, Deliverable Approval & Revision Workflow, Support Ticket System, Project Scoped Chat

---

## 1. Executive Summary

Phân hệ **Phase 8: Customer Portal + Multi-Tenant Client Experience** đã được thiết lập, kiểm toán bảo mật và kiểm thử tự động toàn diện qua bộ test e2e `apps/api/test/phase8-client-portal.e2e-spec.ts`:

| Tiêu chí | Nội dung kiểm thử | Kết quả | Trạng thái |
|---|---|---|:---:|
| **1. Multi-Tenant Data Isolation** | Client A đăng nhập và chỉ thấy dự án thuộc công ty của mình (`client_company_id`). Khi cố tình gọi API dự án của Client B (`GET /api/v1/projects/client/:id`), hệ thống từ chối dứt khoát với HTTP 403 `PROJECT_CLIENT_ACCESS_DENIED`. | Cách ly tuyệt đối tại Backend API & Database RLS, không phụ thuộc vào frontend. | ✅ PASS |
| **2. Client Deliverable Approval** | Client xem ấn phẩm nghiệm thu, thực hiện duyệt (`approved`) hoặc yêu cầu chỉnh sửa (`rejected`) kèm `decision_note` chi tiết. | Đồng bộ tức thì với `workflow_approval_requests` và kích hoạt automation event. | ✅ PASS |
| **3. Support Ticket System** | Client gửi yêu cầu hỗ trợ (`POST /api/v1/support/tickets`) gắn với dự án và công ty. Hệ thống theo dõi trạng thái `open`, `in_progress`, `waiting_client`, `resolved`, `closed`. | Tạo và phân loại ticket thành công theo mức độ ưu tiên (`priority`). | ✅ PASS |
| **4. Project Scoped Chat** | Client trao đổi trực tiếp với Project Manager trong phạm vi dự án (`type = 'project'`). Chặn tuyệt đối việc client tham gia room chat hoặc gửi tin nhắn vào dự án của công ty khác (HTTP 404 / 403). | Bảo mật kênh giao tiếp khách hàng. | ✅ PASS |
| **5. Notification Delivery** | Client nhận các thông báo về ấn phẩm mới chờ duyệt, cập nhật tiến độ dự án, phản hồi ticket và tin nhắn chat từ PM. | Tích hợp qua `NotificationsService`. | ✅ PASS |
| **6. Business Confidentiality Masking** | Ẩn toàn bộ task kỹ thuật nội bộ, chi phí nhân công, tỷ suất lợi nhuận và bình luận nội bộ trên Client Portal. | Client chỉ thấy dữ liệu nghiệm thu và tiến độ tổng quan. | ✅ PASS |

---

## 2. Chi tiết phân hệ Client Portal (`/app/client`)

1. **Client Dashboard (`/app/client`):**
   - Tổng hợp dự án đang thực hiện (`active projects`).
   - Tỷ lệ tiến độ tổng quan (`project progress`).
   - Hàng đợi ấn phẩm chờ khách hàng phê duyệt (`pending approvals`).
   - Tài liệu & sản phẩm đã nghiệm thu.
2. **Project Detail Client View (`/app/client/projects/[projectId]`):**
   - Tổng quan kế hoạch bàn giao (Milestones & Timeline).
   - Danh sách ấn phẩm đã được duyệt (`approved deliverables`).
   - Tải file thiết kế/tài liệu phiên bản chính thức.
3. **Approvals Hub (`/app/client/approvals`):**
   - Giao diện ký duyệt ấn phẩm và gửi ghi chú yêu cầu chỉnh sửa (Request Revision).
4. **Support Ticket Portal (`/app/client/support`):**
   - Quản lý yêu cầu hỗ trợ khách hàng, gửi tin nhắn trao đổi trong ticket, đánh giá kết quả xử lý.
5. **Contracts & Invoices View (`/app/client/contracts`, `/app/client/invoices`):**
   - Tra cứu hợp đồng kinh tế và hóa đơn thanh toán thuộc sở hữu của doanh nghiệp khách hàng.

---

## 3. Kết quả kiểm thử tự động

- **E2E Test Suite:** `apps/api/test/phase8-client-portal.e2e-spec.ts` **PASS** 7/7 scenarios.
- **Unit & Integration Tests:** 67/67 test suites **PASS** (615/615 tests).
- **All E2E Suites:** 16/16 test suites **PASS** (138/138 tests).
- **Web Frontend Tests:** 14/14 test suites **PASS** (80/80 tests).
- **Production Build:** NestJS Backend & Next.js 16 (Turbopack) build thành công 100%.
