# Hướng dẫn Phát triển Local (Development Guide)

Tài liệu này hướng dẫn cách chạy và phát triển dự án PGS Hub trên môi trường máy cá nhân.

## Các cổng (Ports) Mặc định
- **Frontend (apps/web)**: `http://localhost:3000`
- **Backend API (apps/api)**: `http://localhost:3001`
  - Healthcheck API: `http://localhost:3001/api/v1/health`

## Quy trình Phát triển trên Nhánh (Branching Workflow)
1. Luôn thực hiện công việc trên một nhánh tính năng mới (ví dụ: `feat/ten-tinh-nang`). Không commit trực tiếp vào `main`.
2. Đẩy nhánh lên GitHub và tạo Pull Request (PR) để được review trước khi merge vào `main`.
3. Tuyệt đối không force push (`git push -f`) làm ghi đè lịch sử Git trên nhánh chung trừ trường hợp đặc biệt được cho phép.

## Quản lý Cấu hình và Môi trường
1. Sao chép `.env.example` thành `.env` để cấu hình các biến môi trường cho Supabase, API URL, và các cấu hình riêng tư khác.
2. Các biến môi trường của Next.js frontend bắt buộc phải có tiền tố `NEXT_PUBLIC_` nếu muốn sử dụng ở phía browser client.
3. Không được đưa các thông tin bảo mật của Backend như `SUPABASE_SECRET_KEY` (service role) vào các biến có tiền tố `NEXT_PUBLIC_`.
