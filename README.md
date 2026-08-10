# PGS HUB - MONOREPO FOUNDATION

PGS Hub là nền tảng quản trị và vận hành PGS Agency, bao gồm hoạt động nội bộ và cổng dành cho khách hàng được phân quyền. Dự án được tổ chức dưới dạng Monorepo sử dụng `pnpm workspace` để quản lý các ứng dụng và thư viện dùng chung.

## Tech Stack

- **Next.js 16** (App Router) — Frontend
- **React 19** — UI Library
- **NestJS 11** — Backend REST API
- **Tailwind CSS v4** — Styling
- **TypeScript** — Type safety cho toàn bộ dự án
- **Supabase** — Database (PostgreSQL), Auth, Storage, Realtime
- **pnpm workspace** — Monorepo management

## Cấu trúc thư mục chính

- `apps/web`: Ứng dụng Next.js (Frontend chính & Client Portal).
- `apps/api`: Ứng dụng NestJS (Backend REST API).
- `packages/*`: Các thư viện dùng chung (`types`, `validation`, `ui`, `config`, `api-client`).
- `supabase`: Cấu trúc migrations, seed và policies cho cơ sở dữ liệu Supabase.
- `docs`: Tài liệu hướng dẫn phát triển và nghiệp vụ hệ thống.

---

## Cấu hình Môi trường (Local Environment Setup)

Dự án sử dụng file cấu hình môi trường riêng cho từng ứng dụng để đảm bảo tính cô lập và bảo mật cao. Tuyệt đối không sử dụng tệp `.env` chung ở thư mục gốc.

### 1. Cấu hình Frontend (`apps/web/.env.local`)

Copy file `apps/web/.env.example` thành `apps/web/.env.local` và điền đầy đủ các thông tin:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### 2. Cấu hình Backend (`apps/api/.env`)

Copy file `apps/api/.env.example` thành `apps/api/.env` và cấu hình các giá trị cần thiết:

```env
APP_ENV=development
PORT=3001
WEB_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key

DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
REDIS_URL=
```

---

## Lệnh Vận hành & Phát triển nhanh

Dự án cung cấp các script vận hành từ thư mục root của monorepo:

### Cài đặt Dependencies

```bash
pnpm install
```

### Chạy Môi trường Phát triển (Local Dev)

```bash
pnpm dev
```

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Health**: [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)

### Kiểm tra Chất lượng Mã nguồn (Quality Gates)

Trước khi tạo Pull Request, đảm bảo toàn bộ các kiểm tra chất lượng sau đây đều vượt qua thành công:

```bash
# Kiểm tra lỗi Linting
pnpm lint

# Tự động sửa lỗi Linting (nếu có thể)
pnpm lint:fix

# Kiểm tra định dạng code (Prettier)
pnpm format:check

# Tự động định dạng lại code
pnpm format

# Kiểm tra kiểu TypeScript
pnpm typecheck

# Chạy Unit & Integration tests
pnpm test

# Biên dịch dự án (Build)
pnpm build
```
