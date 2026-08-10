# PGS HUB - HƯỚNG DẪN PHÁT TRIỂN (DEVELOPMENT GUIDE)

Tài liệu này hướng dẫn quy trình phát triển, cấu hình môi trường phát triển cục bộ và quy trình tích hợp mã nguồn (CI/CD) cho PGS Hub.

---

## 1. Môi trường phát triển cục bộ (Local Development)

- **Node.js**: Phiên bản LTS khuyến nghị (v20+).
- **pnpm**: Trình quản lý gói chính (v11+).
- **Cổng kết nối mặc định**:
  - Web App (Next.js): Cổng 3000 -> `http://localhost:3000`
  - API Service (NestJS): Cổng 3001 -> `http://localhost:3001/api/v1`

---

## 2. Cấu hình biến môi trường

Mỗi ứng dụng tự quản lý tệp cấu hình môi trường riêng biệt tại runtime:

- **Web App**:
  - Tệp: `apps/web/.env.local`
  - Ví dụ: `apps/web/.env.example`
  - Biến bắt buộc: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **API Service**:
  - Tệp: `apps/api/.env`
  - Ví dụ: `apps/api/.env.example`
  - Biến bắt buộc: `PORT`, `WEB_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`.

---

## 3. Quy trình làm việc với Database (Database Migration Workflow)

Supabase DB được quản lý bằng cơ chế migration lưu vết trên Git:

1. **Tạo migration file**:
   Các file migration SQL được lưu trữ tại thư mục `supabase/migrations/` dưới dạng `<timestamp>_name.sql`.
2. **Áp dụng Migration**:
   - Chạy migration cục bộ lên database local hoặc dev project của Supabase để kiểm thử.
   - Xác thực cấu trúc bảng (schema), các chính sách bảo mật RLS (Row Level Security) hoạt động chính xác.
3. **Đẩy lên Git**:
   Commit tệp SQL migration mới vào nhánh tính năng của bạn. Khi được phê duyệt và merge vào `main`, CI/CD hoặc quy trình tự động sẽ áp dụng thay đổi lên môi trường staging/production.
4. **Không sửa trực tiếp**: Tuyệt đối không thay đổi schema trực tiếp trên giao diện quản trị Supabase Dashboard của môi trường Staging/Production mà không thông qua file SQL migration trong mã nguồn.

---

## 4. Quy trình phát triển nhánh Git (Git Branching & PR Workflow)

Chúng tôi tuân thủ quy trình phát triển nghiêm ngặt dựa trên nhánh tính năng:

- **Nhánh chính**: `main` (Luôn ở trạng thái có thể chạy ổn định).
- **Nhánh tính năng**:
  - Đặt tên theo dạng: `feat/phase-<xx>-<name>` (ví dụ: `feat/phase-00-foundation`).
  - Tuyệt đối không commit trực tiếp vào `main`.
- **Tạo Pull Request (PR)**:
  - Khi hoàn thành tính năng của một Phase, đẩy nhánh lên GitHub và mở Pull Request hướng vào `main`.
  - Tiêu đề PR cần phản ánh rõ nội dung Phase (ví dụ: `Phase 0: PGS Hub Foundation`).
  - PR chỉ được phép merge khi vượt qua (PASS) toàn bộ các Quality Gate kiểm tra tự động và quá trình review phê duyệt thủ công.

---

## 5. Quy trình Kiểm tra Chất lượng (Quality Gates)

Trước khi push mã nguồn hoặc mở PR, lập trình viên bắt buộc phải chạy bộ lệnh kiểm tra chất lượng tại thư mục gốc:

1. **Cài đặt gói phụ thuộc**:
   ```bash
   pnpm install
   ```
2. **Kiểm tra cú pháp & định dạng (Lint & Format)**:
   ```bash
   pnpm lint
   pnpm format:check
   ```
3. **Kiểm tra kiểu dữ liệu (TypeScript Strict Check)**:
   ```bash
   pnpm typecheck
   ```
4. **Chạy bộ kiểm thử (Tests)**:
   ```bash
   pnpm test
   ```
5. **Biên dịch thử nghiệm (Production Build)**:
   ```bash
   pnpm build
   ```

Toàn bộ các bước trên phải kết thúc thành công với mã thoát `0`. Việc sử dụng các phương pháp che giấu lỗi như `|| true` hoặc tắt strict checks là không được chấp nhận.
