# PGS HUB — HƯỚNG DẪN TRIỂN KHAI VẬN HÀNH (DEPLOYMENT MANUAL)

Tài liệu hướng dẫn chi tiết dành cho Chủ sở hữu / Quản trị viên tự triển khai hệ thống PGS Hub khi sẵn sàng.

---

## 1. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

- **Node.js**: Phiên bản 22.x (LTS)
- **Package Manager**: pnpm 11.20.0
- **Cơ sở dữ liệu**: Supabase (PostgreSQL 15+) có Auth, Storage, Extensions.
- **Nền tảng Host khuyến nghị**: Coolify / Docker Compose / VPS Linux.

---

## 2. BIẾN MÔI TRƯỜNG BẮT BUỘC (ENVIRONMENT VARIABLES)

### A. API Backend (pps/api/.env)

`env
APP_ENV=production
PORT=3001
WEB_URL=https://app.yourdomain.com
SUPABASE_URL=https://umtgfaqjoqbsdzwpqizq.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-key
INITIAL_ADMIN_EMAIL=admin@yourdomain.com
TRUST_PROXY=true
CALENDARIFIC_API_KEY=your-calendarific-key (tùy chọn khi đồng bộ ngày lễ)
`

### B. Web Frontend (pps/web/.env.production)

`env
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://umtgfaqjoqbsdzwpqizq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
`

---

## 3. LỆNH BUILD & KHỞI CHẠY (BUILD & RUN COMMANDS)

`ash

# 1. Cài đặt dependencies chính xác

pnpm install --frozen-lockfile

# 2. Build toàn bộ dự án

pnpm build

# 3. Khởi chạy Web Frontend (Port 3000)

pnpm --filter web start

# 4. Khởi chạy API Backend (Port 3001)

pnpm --filter api start:prod
`

---

## 4. QUY TRÌNH ÁP DỤNG DATABASE MIGRATION

1. Kiểm tra backup cơ sở dữ liệu trước khi chạy.
2. Áp dụng tuần tự các migration theo thứ tự timestamp trong thư mục supabase/migrations.
3. **CẢNH BÁO**: **KHÔNG ÁP DỤNG** file 20260819130000_phase10_all_missing_modules.sql.
4. Kiểm tra Health check endpoint sau deploy: GET https://api.yourdomain.com/api/v1/health ➔ 200 OK.
