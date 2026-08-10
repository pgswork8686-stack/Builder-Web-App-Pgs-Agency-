# PGS Hub

PGS Hub là hệ thống quản trị và vận hành nội bộ dành riêng cho PGS Agency.

## Công nghệ sử dụng (Stack)
- **Quản lý Monorepo**: `pnpm workspace`
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **Backend API**: NestJS 11, TypeScript
- **Cơ sở dữ liệu & Authentication**: Supabase (PostgreSQL)

## Cấu trúc thư mục (Monorepo Structure)
- `apps/web`: Ứng dụng client-side Next.js.
- `apps/api`: Ứng dụng backend API NestJS.
- `packages/`: Các thư viện dùng chung (`types`, `validation`, `config`, `ui`, `api-client`).
- `supabase/`: Thư mục chứa cấu hình Supabase Database Migrations và Policies.
- `docs/`: Tài liệu hướng dẫn phát triển và tài liệu ngữ cảnh dự án.

## Yêu cầu Môi trường (Prerequisites)
- Node.js >= v20
- pnpm >= v9

## Hướng dẫn cài đặt và chạy local (Local setup)

1. **Cài đặt các gói phụ thuộc (từ root)**:
   ```bash
   pnpm install --ignore-scripts
   ```
2. **Cấu hình môi trường**:
   Sao chép tệp `.env.example` thành `.env` ở thư mục gốc và bổ sung các khóa Supabase của bạn.

3. **Chạy các ứng dụng ở chế độ phát triển (Local Development)**:
   - Chạy cả Web và API song song:
     ```bash
     pnpm dev
     ```
   - Chỉ chạy Web client (cổng 3000):
     ```bash
     pnpm dev:web
     ```
   - Chỉ chạy API backend (cổng 3001):
     ```bash
     pnpm dev:api
     ```

## Lệnh kiểm tra chất lượng mã nguồn (Quality Commands)
- **Lint mã nguồn**: `pnpm lint`
- **Typecheck (TypeScript)**: `pnpm typecheck`
- **Chạy kiểm thử (Test)**: `pnpm test`
- **Build dự án**: `pnpm build`

## Chiến lược phát triển nhánh (Branch strategy)
- Nhánh chính: `main` (không commit trực tiếp).
- Tạo nhánh phụ dạng `feat/feature-name` để phát triển tính năng và tạo Pull Request để merge vào nhánh chính.
