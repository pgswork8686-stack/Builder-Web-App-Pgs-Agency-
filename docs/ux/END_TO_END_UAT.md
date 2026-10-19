# End-to-End UAT

> Phạm vi: toàn bộ kết quả dưới đây chạy trên Supabase **disposable** cấp trong runner CI, với tài khoản seed tổng hợp. **Không phải UAT trên staging hay production.**

## Kết quả CI trên commit `8423585`

Commit: `8423585` — `fix(a11y): keep light slate text on the dark sidebar and landing hero` (nhánh `feat/pgs-audit-ux-uat`, 2026-10-19).

Tất cả check-run `success`:

| Check                         | Run                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Database-backed UAT + browser | [run 39225074368](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39225074368) |
| Quality gates                 | run 39225074496 và 39225080139                                                                               |
| API production container      | run 39225074496 và 39225080139                                                                               |
| cPanel Node 22 artifact       | run 39225074496 và 39225080139                                                                               |
| Vercel Preview Comments       | success                                                                                                      |

### Duyệt trang theo vai trò + axe

76/76 lượt PASS (5 vai trò × route chính × 375/768/1024/1440px), 0 vi phạm axe serious/critical. Cổng axe đang chặn (`UAT_AXE_GATE`). Nguồn: `uat-evidence/responsive-summary.md`.

### E2E liên vai trò 01–07

Mỗi luồng thao tác UI bằng Playwright, truy vấn DB (pg) sau từng bước để xác nhận bản ghi và notification, có kiểm refresh/đăng nhập mới và 375/768px + axe. Step "Database-backed UAT + browser" của run trên có đủ các bước sau đều `success`; số bước lấy từ `uat-evidence/flowNN/flowNN-results.json`:

| Luồng | Script                                                                  | Kết quả | Số bước           | Ghi chú trong file kết quả                                                       |
| ----- | ----------------------------------------------------------------------- | ------- | ----------------- | -------------------------------------------------------------------------------- |
| 01    | `scripts/uat-flow01-project-init.mjs`                                   | PASS    | 13                | Phòng ban gán qua `PATCH /admin/projects/:id` (wizard chưa có trường)            |
| 02    | `scripts/uat-flow02-task-assignment.mjs`                                | PASS    | 7                 | Dùng dự án do Flow 01 tạo                                                        |
| 03    | `scripts/uat-flow03-task-execution.mjs`                                 | PASS    | 8                 | Dùng task do Flow 02 tạo                                                         |
| 04    | `scripts/uat-flow04-internal-review.mjs`                                | PASS    | 8                 | **Nhánh workflow chưa chạy**: "No ready workflow item with an open primary task" |
| 05    | `scripts/uat-flow05-client-acceptance.mjs`, `scripts/uat-flow05-ui.mjs` | PASS    | 13 (API) + 9 (UI) | —                                                                                |
| 06    | `scripts/uat-flow06-finance.mjs`                                        | PASS    | 8                 | —                                                                                |
| 07    | `scripts/uat-flow07-handover-close.mjs`                                 | PASS    | 9                 | —                                                                                |

## Hai khoảng hở đã xử lý sau `8423585`

Hai thay đổi này đã chạy PASS **cục bộ** (2026-10-19) trên Supabase disposable, theo đúng thứ tự CI: full UAT → Flow 05 → Flow 01 → 02 → 03 → 04; file kết quả Flow 01 và Flow 04 không còn ghi chú "design gap" hay "not exercised". **Chưa có CI xác nhận** — cần run `uat-disposable` của commit chứa chúng để đóng hoàn toàn.

1. **Flow 04 — nhánh workflow.** Bước 6 trước đây chỉ chạy khi tình cờ có hạng mục workflow sẵn sàng, nên run `8423585` bỏ qua. Nay bước 6 tự dựng fixture trên dự án do Team Leader quản lý: khởi tạo workflow (`workflow_instantiate_project_service`), đặt hạng mục A (task chính mở) chặn hạng mục B (`finish_to_start`, B ở trạng thái `blocked`). Kịch bản kiểm: task ở `review` thì A chưa hoàn thành và B vẫn `blocked`; sau khi Team Leader duyệt `done`, A thành `completed` và B chuyển `ready`. Thiếu workflow/hạng mục thì **FAIL**, không còn bỏ qua.
2. **Flow 01 — phòng ban.** Wizard tạo dự án có thêm trường "Phòng ban phụ trách" (bước 2, tùy chọn, `apps/web/components/phase3/project-create-wizard-dialog.tsx`). Flow 01 chọn phòng ban trên UI và kiểm `projects.department_id` trong DB; bước gán bằng API đã bỏ.

## Chưa làm

- Staging/production UAT (xem `UI_BACKEND_GAPS.md`).
- Kịch bản từ chối/yêu cầu sửa ở các luồng ngoài Flow 04, và 4 hotspot FALLBACK trong prototype (G-10).
