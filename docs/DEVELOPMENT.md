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

---

## 6. Cấu hình TypeScript: `skipLibCheck`

### skipLibCheck — Web

- **Status**: `true`
- **Reason**: Gặp lỗi xung đột type trong thư viện Next.js khi tắt skipLibCheck.
- **Affected dependency**: `next`
- **Version**: `16.3.0`
- **Actual TypeScript errors observed**:
  - `TS6200: Definitions of the following identifiers conflict with those in another file` liên quan tới `unstable_cache`, `revalidateTag`... trong các tệp `.next/types/cache-life.d.ts` và `.next/dev/types/cache-life.d.ts`.
  - `TS2300: Duplicate identifier 'LayoutProps'` trong các tệp `.next/types/routes.d.ts` và `.next/dev/types/routes.d.ts`.
  - `TS2304: Cannot find name 'URLPatternInput' | 'URLPatternOptions' | 'URLPattern'` trong `node_modules/next/dist/server/web/spec-extension/url-pattern.d.ts` do thiếu định nghĩa DOM tương thích.
- **Application source strict mode**: `enabled` (`"strict": true` và `"allowJs": false` trong tsconfig.json).

### skipLibCheck — API

- **Status**: `false`
- **Reason**: Thử nghiệm thực tế tắt `skipLibCheck` thành công mà không phát sinh bất kỳ lỗi biên dịch nào.
- **Application source strict mode**: `enabled` (`"strict": true` cùng với các quy tắc strict nâng cao).

- **`packages/*`**: `skipLibCheck: false` — Các package dùng chung không có dependency phức tạp, kiểm tra type strict hoàn chỉnh.

---

## 7. Cấu hình `allowBuilds` trong `pnpm-workspace.yaml`

Hai package sau được phép chạy lifecycle build scripts:

- **`esbuild`**: Yêu cầu native binary build. Được sử dụng bởi:
  - NestJS CLI (`@nestjs/cli`) → Webpack → `terser-webpack-plugin` → `esbuild`
  - Vite (bundler cho Vitest trong `apps/web` và `packages/validation`) → `esbuild`
  - `ts-jest` (test runner cho `apps/api`) → `esbuild`
- **`sharp`**: Yêu cầu native binary build. Được sử dụng bởi:
  - Next.js (`next`) → Image Optimization → `sharp`

Nếu không cho phép build, các package này sẽ không thể cài đặt native binaries và sẽ gây lỗi runtime.

---

## 8. Ghi chú về Package Scripts

- Các package dùng chung (`packages/*`) chỉ khai báo script `typecheck` (chạy `tsc --noEmit` thật) và `test` (nếu có test thật).
- Các script `build`, `lint`, `lint:fix` không được khai báo nếu package chưa có mã nguồn cần build/lint thật.
- Root scripts sử dụng `pnpm -r --if-present` để bỏ qua package không khai báo script tương ứng, thay vì dùng `echo` giả mạo kết quả.
