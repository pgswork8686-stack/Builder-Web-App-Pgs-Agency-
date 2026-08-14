# PGS HUB / Điệp Web App

PGS Hub là nền tảng quản trị và vận hành toàn diện cho PGS Agency, bao gồm các phân hệ nghiệp vụ nội bộ (Quản lý tổ chức, nhân sự, dự án, công việc, chấm công, nghỉ phép, tài chính, thông báo, chat nội bộ, automation) và Cổng thông tin khách hàng (Client Portal) được phân quyền bảo mật cao.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + TypeScript
- **Backend**: NestJS 11 + Express + TypeScript + Socket.IO + Zod
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth, Storage, Realtime)
- **Monorepo**: `pnpm workspace` + Turborepo

---

## Cấu trúc thư mục

- `apps/web`: Ứng dụng Next.js (Dashboard, Client Portal, Workspaces).
- `apps/api`: Ứng dụng NestJS REST API & Realtime Gateway.
- `packages/*`: Thư viện dùng chung (`types`, `validation`, `ui`, `config`, `api-client`).
- `supabase/migrations`: Migration SQL, Row Level Security (RLS) policies, triggers và RPC functions.
- `docs`: Tài liệu kiến trúc, bảo mật, quy trình vận hành và kiểm thử.

---

## Yêu cầu Hệ thống (Requirements)

- **Node.js**: `>= 20.x` (khuyên dùng Node.js LTS hoặc 24.x)
- **pnpm**: `>= 10.x` hoặc `11.x` (`corepack enable`)

---

## Cấu hình Môi trường (Environment Setup)

Dự án sử dụng file `.env` riêng biệt cho từng ứng dụng:

### 1. Cấu hình Backend API (`apps/api/.env`)

Copy `apps/api/.env.example` thành `apps/api/.env`:

```env
APP_ENV=development
PORT=3001
WEB_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key

INITIAL_ADMIN_EMAIL=admin@example.com
```

*Các biến cấu hình tùy chọn (Production Throttling & Proxy):*
```env
THROTTLE_TTL=60000
THROTTLE_LIMIT=120
TRUST_PROXY=true
```

### 2. Cấu hình Frontend Web (`apps/web/.env.local`)

Copy `apps/web/.env.example` thành `apps/web/.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

---

## Lệnh Phát triển & Vận hành

```bash
# Cài đặt dependencies
pnpm install

# Chạy development (cả API và Web)
pnpm dev

# Chạy riêng API (port 3001)
pnpm --filter api start:dev

# Chạy riêng Web (port 3000)
pnpm --filter web dev
```

- **Web App**: `http://localhost:3000`
- **API Health**: `http://localhost:3001/api/v1/health`

---

## Quality Gates & Kiểm thử

Trước khi release hoặc merge, tất cả các Quality Gates sau đây phải PASS 100%:

```bash
# Kiểm tra Linting
pnpm lint

# Tự động sửa lỗi Linting & Formatting
pnpm lint:fix
pnpm format

# Kiểm tra TypeScript type safety
pnpm typecheck

# Chạy toàn bộ Unit & E2E Tests
pnpm test

# Build Production Bundles
pnpm build
```

---

## Security & Production Hardening (Phase 8)

Hệ thống được bảo vệ qua các lớp bảo mật toàn diện:
1. **API Security Headers**: Helmet kích hoạt CSP, Frame protection (`frameAncestors: none`), X-Content-Type-Options, Referrer-Policy, HSTS (Production).
2. **Strict CORS**: Whitelist origin theo `WEB_URL`, kiểm tra nguồn request chặt chẽ.
3. **Throttling / Rate Limiting**: Tích hợp `@nestjs/throttler` bảo vệ chống brute-force và DDoS.
4. **Global Validation & Sanitization**: NestJS `ValidationPipe` bật `whitelist: true, forbidNonWhitelisted: true`.
5. **Standardized Error Handling**: Không bao giờ leak database internals, SQL syntax, hay stack trace ra ngoài client.
6. **Correlation IDs & Structured Logging**: Tự động sinh `X-Request-Id` và log latency mà không ghi token / mật khẩu.
7. **Client Data Isolation**: Kiểm tra server-side quyền công ty khách hàng ở tất cả các module. Client A không thể truy cập dữ liệu của Client B.
8. **Chat & Realtime Security**: Xác thực token socket, kiểm tra lại quan hệ dự án / công ty khách hàng theo thời gian thực (revalidation). Thành viên bị gỡ khỏi dự án sẽ mất quyền chat ngay lập tức.
9. **Private Storage & Geofence**: Bằng chứng chấm công được tính khoảng cách Haversine theo tọa độ văn phòng; các tệp tin hợp đồng / hóa đơn được bảo vệ trong private buckets với signed URLs có thời hạn.

---

## Deployment Checklist

- [ ] File `.env` thực tế được cấu hình ngoài Git repo.
- [ ] `SUPABASE_SECRET_KEY` chỉ lưu ở server-side Backend (`apps/api`), không đưa vào frontend bundle.
- [ ] Các migration database Supabase đã được apply đầy đủ.
- [ ] RLS policies và database trigger validation đang hoạt động.
- [ ] Buckets storage được cấu hình `private` đối với file tài chính / chấm công / dự án.
- [ ] Biến môi trường `WEB_URL` và `NEXT_PUBLIC_API_URL` trỏ đúng domain production.
- [ ] Reverse proxy cấu hình HTTPS và `trust proxy` hợp lệ.
- [ ] Health check `GET /api/v1/health` trả về `status: "ok"`.
- [ ] Toàn bộ Quality Gates (Lint, Typecheck, Test, Build) PASS.
