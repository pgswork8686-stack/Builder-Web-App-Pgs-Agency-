# PGS HUB - PROJECT MASTER CONTEXT

Tài liệu này đóng vai trò là nguồn thông tin chính thức duy nhất (Source-of-truth) quy định toàn bộ mục tiêu, cấu trúc nghiệp vụ, và mô hình phân quyền của hệ thống PGS Hub.

---

## 1. TỔNG QUAN DỰ ÁN

- **Tên dự án**: PGS Hub.
- **Bản chất**: PGS Hub là nền tảng quản trị và vận hành tập trung của PGS Agency, bao gồm các hoạt động quản trị nội bộ của doanh nghiệp và cổng thông tin khách hàng (Client Portal) được phân quyền nghiêm ngặt.
- **Không phải**: Đây là một Web Application toàn diện, không phải là các script tự động hóa Google Apps Script hay các bảng tính Google Sheets độc lập. Kiến trúc cũ của Google Apps Script/Google Sheets coi như đã bị bãi bỏ hoàn toàn (OLD / ABANDONED).

---

## 2. CÔNG NGHỆ CHỦ ĐẠO (TECH STACK)

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS v4.
- **Backend**: NestJS, TypeScript.
- **Cơ sở dữ liệu & Cơ sở hạ tầng**: PostgreSQL, Supabase (bao gồm Supabase Auth cho xác thực, Supabase Storage cho lưu trữ tệp tin, và Supabase Realtime cho các cập nhật thời gian thực).
- **Lưu trữ tệp tin**: Sử dụng Supabase Storage trực tiếp (chưa tích hợp Cloudflare R2 ban đầu).
- **Hệ thống mở rộng tương lai (Chưa triển khai ở Phase 0)**:
  - Redis (dành cho caching/session/queue sau này).
  - Expo (dành cho Mobile App sau này).
  - AI Gateway/Copilot.

---

## 3. MÔ HÌNH TRIỂN KHAI VÀ PHÁT TRIỂN

- **Môi trường phát triển**:
  - Phát triển cục bộ (Local first).
  - Frontend Web chạy tại: `http://localhost:3000`
  - Backend API chạy tại: `http://localhost:3001` (với global prefix là `/api/v1`).
- **Triển khai Production**:
  - Địa chỉ dự kiến: `hub.pgsagency.vn` (chưa cấu hình ở Phase 0, không được thực hiện deploy production tự động trong phase này).

---

## 4. QUY MÔ HỆ THỐNG VÀ HIỆU NĂNG MỤC TIÊU (SCALE TARGET)

Hệ thống được thiết kế để chịu tải và mở rộng dài hạn với các chỉ số mục tiêu:

- **Người dùng hoạt động**: 100.000+ users.
- **Truy cập đồng thời**: 100+ concurrent connections.
- **Dung lượng dữ liệu**: 100GB+ data.
- **Dữ liệu lớn**: Hệ thống chứa khối lượng bản ghi lớn về dự án/công việc (project/task) và lịch sử chấm công (attendance logs).
- **Nguyên tắc thiết kế bắt buộc**: Luôn áp dụng phân trang (pagination), Server-side filtering, và đánh chỉ mục (indexing) tối ưu cho cơ sở dữ liệu ngay từ đầu.

---

## 5. MÔ HÌNH PHÂN QUYỀN (5 ROLES)

Hệ thống PGS Hub quy định chặt chẽ 5 vai trò (roles) người dùng với phạm vi thẩm quyền chi tiết:

1. **Admin (Quản trị viên)**: Quyền hạn tối cao trên toàn hệ thống, quản lý người dùng, phê duyệt tài khoản, cấu hình hệ thống và truy cập toàn bộ dữ liệu.
2. **Team Leader (Trưởng nhóm)**: Quản lý thành viên trong nhóm, phân công công việc, giám sát/theo dõi dự án thuộc phạm vi nhóm phụ trách, phê duyệt chấm công cho thành viên trong nhóm.
3. **Employee (Nhân viên)**: Thực hiện công việc/nhiệm vụ được giao, chấm công cá nhân, xem dữ liệu thông tin cá nhân của chính mình.
4. **Accountant (Kế toán)**: Quản lý khách hàng, hợp đồng, hóa đơn, thanh toán, các khoản thu/phải thu, thu chi, chi phí dự án, dữ liệu chấm công/bảng công đã được phê duyệt, và các báo cáo tài chính. (Lưu ý: Không quản lý lương trừ khi được quy định rõ).
5. **Client (Khách hàng)**: Chỉ theo dõi các dự án, công việc (tasks), và sản phẩm bàn giao (deliverables) được đánh dấu `client_visible` của chính mình thông qua Client Portal. Tuyệt đối không được xem các công việc và bình luận nội bộ.

---

## 6. NGUYÊN TẮC DUY NHẤT MỘT ADMIN (SINGLE ADMIN POLICY)

- Hệ thống chỉ cho phép duy nhất một tài khoản Admin tối cao:
  - **Họ và tên**: Phùng Quốc Bảo
  - **Email**: pgsword6868@gmail.com
  - **Số điện thoại**: 0943894403
- **Quy tắc**: Tuyệt đối không cho phép tạo tài khoản Admin thứ hai dưới mọi hình thức, kể cả từ màn hình phê duyệt hay phân quyền của quản trị viên.

---

## 7. QUY TRÌNH DUYỆT TÀI KHOẢN MỚI (PENDING ACCOUNTS)

- Khi một người dùng mới đăng ký qua Supabase Auth (bao gồm cả Google Login):
  - Trạng thái ban đầu của tài khoản luôn luôn là **Pending (Chờ duyệt)**.
  - Người dùng ở trạng thái Pending không được phép truy cập vào bất kỳ chức năng hay dữ liệu nào của hệ thống.
  - Admin tối cao kiểm tra danh sách tài khoản chờ duyệt, tiến hành phê duyệt thủ công, lựa chọn và gán **Role** phù hợp, sau đó chuyển trạng thái tài khoản sang **Active**.
  - Không tự động kích hoạt tài khoản và không tự động gán vai trò mặc định (no auto-role, no auto-active).

---

## 8. MÔ HÌNH PHÂN QUYỀN DỮ LIỆU (DATA PERMISSION MODEL)

Phân quyền truy cập dữ liệu được áp dụng ở mức tối thiểu cần thiết và kiểm soát trực tiếp tại backend (API), không chỉ ẩn/hiện menu trên giao diện frontend:

- **`all`**: Quyền truy cập toàn bộ dữ liệu hệ thống (chỉ dành cho Admin và một số màn hình đặc thù của Kế toán).
- **`team`**: Chỉ truy cập dữ liệu thuộc nhóm/phòng ban của mình.
- **`assigned`**: Chỉ truy cập dữ liệu liên kết trực tiếp với các thực thể được giao (ví dụ: Task được giao).
- **`own`**: Chỉ truy cập dữ liệu cá nhân của chính mình (ví dụ: phiếu lương cá nhân, logs chấm công cá nhân).
- **`client`**: Chỉ xem dữ liệu của chính doanh nghiệp/dự án của khách hàng đó.
- **`none`**: Không có quyền truy cập.

---

## 9. GIỚI HẠN PHẠM VI TRUY CẬP CỦA KHÁCH HÀNG (CLIENT ROLE SCOPE)

Vai trò **Client** tuyệt đối không được phép xem hoặc tiếp cận các thông tin nội bộ sau:

- Các công việc nội bộ (internal tasks).
- Bình luận nội bộ giữa các nhân viên (internal comments).
- Bảng lương, chi phí, lợi nhuận của PGS Agency (salary, cost, profit).
- Thông tin của khách hàng khác (other clients).
- Lịch sử kiểm toán nội bộ (internal audit logs).

---

## 10. DỊCH VỤ VÀ BẢNG GIÁ PGS (SERVICES & SERVICE PACKAGES)

PGS Agency cung cấp danh sách 15 dịch vụ chính thức:

1. Thiết Kế Website
2. Thiết Kế Landing Page
3. Chăm Sóc Website
4. SEO Tổng Thể
5. SEO Nội Dung
6. Thiết Kế Google Maps
7. Google Ads
8. Facebook Ads
9. TikTok Ads
10. Vận Hành Instagram
11. Quản Lí Fanpage Chuyên Nghiệp
12. Content Social
13. Định Hướng Xây Kênh
14. Marketing Tổng Thể
15. PR Báo Chí & Truyền Thông

Hệ thống PGS Hub quản lý 2 khái niệm dịch vụ và gói giá riêng biệt:

- **Dịch vụ đơn lẻ (`services`)**: Các dịch vụ chính thức nêu trên do PGS Agency cung cấp.
- **Gói dịch vụ (`service_packages`)**: Là các gói, mức giá hoặc phương án thương mại cụ thể của một dịch vụ đơn lẻ (ví dụ: Dịch vụ "SEO Tổng Thể" có các gói "Gói A", "Gói B", "Gói C"). Khái niệm này không phải là combo kết hợp nhiều dịch vụ đơn lẻ khác nhau (nếu cần combo nhiều dịch vụ sau này sẽ thiết kế một thực thể riêng).
- **Quy tắc giá (Pricing)**:
  - Không scrape giá từ website.
  - Không seed giá dịch vụ.
  - Không hardcode giá dịch vụ/gói dịch vụ trong source code.
  - Admin tối cao sẽ nhập và quản lý bảng giá thủ công hoàn toàn trực tiếp trong PGS Hub để đảm bảo tính linh hoạt thương mại tối đa.

---

## 11. DỮ LIỆU MẪU (DEMO DATA)

- Mọi dữ liệu mẫu phục vụ chạy thử hoặc demo phải được đánh dấu rõ ràng qua thuộc tính:
  - `is_demo = true`
  - `demo_batch_id = PGS-DEMO-V1`
- Việc này giúp dễ dàng cô lập và dọn sạch dữ liệu thử nghiệm khi chuyển sang chạy thực tế.

---

## 12. QUẢN LÝ DỰ ÁN (PROJECT ARCHITECTURE)

- Một dự án (Project) có thể chứa nhiều dịch vụ đơn lẻ khác nhau (Project Multi-Service).
- Cấu trúc quan hệ thực thể hỗ trợ bảng trung gian `project_services` để liên kết một dự án với nhiều dịch vụ. Không áp đặt quy tắc cứng nhắc `1 project = 1 service`. Khái niệm này hoàn toàn độc lập với `service_packages` (gói giá của dịch vụ).

---

## 13. CHẤM CÔNG (ATTENDANCE)

- Hệ thống chấm công hỗ trợ ghi nhận dữ liệu linh hoạt trong tương lai từ nhiều nguồn: Giao diện Web, Mobile App, Máy chấm công phần cứng, nhập file CSV, và điều chỉnh thủ công của Admin (Admin Adjustment).
- **Quy tắc bảo mật**: Không bao giờ lưu trữ mẫu sinh trắc học trực tiếp (biometric template) trong cơ sở dữ liệu để bảo vệ quyền riêng tư của nhân viên.

---

## 14. TRÍ TUỆ NHÂN TẠO (AI INTEGRATION)

- Hỗ trợ các trợ lý ảo tương lai: **PGS Work Copilot** (hỗ trợ công việc) và **PGS Finance Copilot** (hỗ trợ phân tích tài chính).
- **Bảo mật AI**: AI phải hoạt động tuân thủ nghiêm ngặt theo mô hình phân quyền của người dùng đang tương tác. Tuyệt đối không cho phép AI truy cập trực tiếp vào cơ sở dữ liệu mà không thông qua các lớp lọc quyền (unrestricted database access).

---

## 15. QUY TRÌNH PHÁT TRIỂN VÀ REVIEW (REVIEW WORKFLOW)

- Quy trình kiểm định và hoàn thành Phase tuân thủ theo luồng:
  `Antigravity DONE → Push → PR → ChatGPT external review PASS = Phase DONE`
- Mọi thay đổi mã nguồn phải đi qua quy trình nghiêm ngặt:
  - Xây dựng và kiểm tra nội bộ qua Antigravity CLI build.
  - Push lên nhánh tính năng riêng trên GitHub (không code trực tiếp trên `main`).
  - Cập nhật cơ sở dữ liệu Supabase qua migration.
  - Tạo Pull Request (PR) để tiến hành đánh giá bên ngoài qua ChatGPT Review.
  - Phải đạt kết quả PASS ở bước ChatGPT external review mới được coi là hoàn thành Phase (Phase DONE) và merge vào nhánh chính.

---

## 16. BẢO MẬT THÔNG TIN NHẠY CẢM (SECRETS)

Tuyệt đối không bao giờ được commit trực tiếp các khóa bí mật lên Git:

- `SUPABASE_SECRET_KEY` (service role key).
- Mật khẩu database trực tiếp.
- Khóa API OpenAI / Google / Apple / SMS.
  Các khóa này chỉ được khai báo thông qua biến môi trường cục bộ được bỏ qua bởi Git (Git ignored `.env` files).

---

## 17. NGÔN NGỮ GIAO DIỆN (LOCALIZATION)

- **Giao diện người dùng (UI)**: Phải hiển thị hoàn toàn bằng **Tiếng Việt**.
- Các định danh kỹ thuật (Technical identifiers, database columns, API keys) có thể sử dụng Tiếng Anh để đảm bảo chuẩn hóa kỹ thuật.

---

## 18. CÁC BUCKET LƯU TRỮ (STORAGE BUCKETS)

Danh sách các Supabase Storage Bucket được quy hoạch cho hệ thống:

- `avatars`: Lưu trữ ảnh đại diện của người dùng.
- `client-files`: Tệp tin và tài liệu của khách hàng.
- `project-files`: Tệp tin và tài liệu của dự án.
- `deliverables`: Sản phẩm bàn giao cho khách hàng.
- `contracts`: Tài liệu hợp đồng.
- `invoices`: Hóa đơn chứng từ.
- `attendance-evidence`: Minh chứng chấm công.
- `ai-documents`: Tài liệu huấn luyện/tra cứu cho AI.
- `demo-files`: Tệp tin dữ liệu mẫu/demo.

_Lưu ý_: Các bucket này **KHÔNG được tạo ở Phase 0** mà sẽ được khởi tạo ở các giai đoạn sau khi có nhu cầu sử dụng thực tế.

---

## 19. NGUỒN THÔNG TIN CHÍNH THỨC (SOURCE-OF-TRUTH PRIORITY)

Khi có sự xung đột thông tin, thứ tự ưu tiên áp dụng như sau:

1. Yêu cầu mới nhất được người dùng xác nhận trực tiếp trong chat.
2. Tài liệu `PROJECT_CONTEXT.md` này.
3. Tài liệu mô tả Phase cụ thể (Phase specification).
4. Mã nguồn thực tế trong repository.
5. Các tài liệu hướng dẫn cũ.
