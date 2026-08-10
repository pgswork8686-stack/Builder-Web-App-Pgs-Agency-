# Master Project Context: PGS Hub

PGS Hub là hệ thống quản trị và vận hành chuyên nghiệp dành riêng cho **PGS Agency**. Hệ thống được xây dựng dưới dạng Web App chất lượng cao, loại bỏ hoàn toàn các giải pháp tạm thời bằng Google Sheets hay Google Apps Script.

## Kiến trúc Tổng thể

PGS Hub sử dụng mô hình Monorepo được quản lý bởi `pnpm workspace`, bao gồm các ứng dụng và thư viện dùng chung:

### 1. Ứng dụng (Apps)
- **`apps/web`**: Web Client sử dụng Next.js (App Router, JavaScript/TypeScript, Tailwind CSS v4, và Supabase Web SDK).
- **`apps/api`**: RESTful API Backend sử dụng NestJS (TypeScript, Node.js, cung cấp endpoints phục vụ các chức năng nghiệp vụ).

### 2. Thư viện dùng chung (Packages)
- **`@pgs/types`**: Định nghĩa kiểu dữ liệu dùng chung (TypeScript).
- **`@pgs/validation`**: Chứa các schema kiểm tra dữ liệu đầu vào (Zod).
- **`@pgs/api-client`**: Client API dùng chung để Web giao tiếp với API.
- **`@pgs/config`**: Cấu hình chung cho toàn hệ thống.
- **`@pgs/ui`**: Thư viện component UI dùng chung.

### 3. Cơ sở dữ liệu (Database)
- **Supabase (PostgreSQL)**: Quản lý cơ sở dữ liệu hệ thống, bảo mật phân quyền dòng (RLS), migrations, và các serverless functions.

## Quy chuẩn Phát triển

1. **Ngôn ngữ**: Sử dụng tiếng Việt làm ngôn ngữ mặc định (`lang="vi"`) cho giao diện người dùng.
2. **Thiết kế**: Font chữ chủ đạo là **Space Grotesk**. Sử dụng bảng màu PGS Design Foundation đã thiết lập sẵn.
3. **Bảo mật**: Tuyệt đối không commit các khóa bí mật (`service_role`, mật khẩu DB) vào kho lưu trữ mã nguồn. Sử dụng file `.env` được cấu hình cục bộ và thêm vào `.gitignore`.
