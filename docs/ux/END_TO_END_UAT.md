# End-to-End UAT

## Trạng thái CI trên HEAD `a67c4e0` (trước các thay đổi này)

Tất cả check-run `success`: Quality gates, Database-backed UAT + browser, API production container, cPanel Node 22 artifact, Vercel Preview Comments.

## Chưa chạy trong phiên này

Máy cục bộ chặn `git` HTTPS (Application Control chặn `libcurl-4.dll`), không có Supabase disposable, chưa `pnpm install`. Vì vậy:

- Không chạy được UAT 72/72, typecheck, hay Playwright.
- Các sửa G-01, G-03, G-04 là **chưa được kiểm chứng bằng chạy**.
- Khi đẩy lên PR #17, CI `uat-disposable` sẽ là phép thử đầu tiên. Dự kiến FAIL do cổng axe mới cho tới khi hết vi phạm `color-contrast` và `select-name`.

## Kế hoạch E2E liên vai trò (chưa thực hiện)

Một spec Playwright cho mỗi luồng 01–07, đăng nhập 5 tài khoản seed, thao tác UI, sau mỗi bước truy vấn DB (pg) để xác nhận bản ghi và notification; thêm kịch bản từ chối/yêu cầu sửa, refresh, deep link, 1440/1024/768/375, kiểm axe.
