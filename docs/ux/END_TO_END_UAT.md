# End-to-End UAT

> Phạm vi: toàn bộ kết quả dưới đây chạy trên Supabase **disposable** cấp trong runner CI, với tài khoản seed tổng hợp. **Không phải UAT trên staging hay production.**

## Kết quả CI mới nhất: commit `4a08bb4`

Commit: `4a08bb4` — `test(uat): exercise workflow unlock in flow 04, department field in flow 01, refresh UAT docs` (nhánh `feat/pgs-audit-ux-uat`, 2026-10-19), nằm ngay sau `8423585`.

Tất cả check-run `success`:

| Check                         | Run                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Database-backed UAT + browser | [run 39235546384](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39235546384) |
| Quality gates                 | run 39235546395 và 39235552493                                                                               |
| API production container      | run 39235546395 và 39235552493                                                                               |
| cPanel Node 22 artifact       | run 39235546395 và 39235552493                                                                               |
| Vercel Preview Comments       | success                                                                                                      |

### E2E liên vai trò 01–07

Mỗi luồng thao tác UI bằng Playwright, truy vấn DB (pg) sau từng bước để xác nhận bản ghi và notification, có kiểm refresh/đăng nhập mới và 375/768px + axe. Số bước và ghi chú lấy từ `uat-evidence/flowNN/flowNN-results.json` của run trên:

| Luồng | Script                                                                  | Kết quả | Số bước           | Ghi chú trong file kết quả |
| ----- | ----------------------------------------------------------------------- | ------- | ----------------- | -------------------------- |
| 01    | `scripts/uat-flow01-project-init.mjs`                                   | PASS    | 12                | không có                   |
| 02    | `scripts/uat-flow02-task-assignment.mjs`                                | PASS    | 7                 | Dùng dự án do Flow 01 tạo  |
| 03    | `scripts/uat-flow03-task-execution.mjs`                                 | PASS    | 8                 | Dùng task do Flow 02 tạo   |
| 04    | `scripts/uat-flow04-internal-review.mjs`                                | PASS    | 9                 | không có                   |
| 05    | `scripts/uat-flow05-client-acceptance.mjs`, `scripts/uat-flow05-ui.mjs` | PASS    | 13 (API) + 9 (UI) | không có                   |
| 06    | `scripts/uat-flow06-finance.mjs`                                        | PASS    | 8                 | không có                   |
| 07    | `scripts/uat-flow07-handover-close.mjs`                                 | PASS    | 9                 | không có                   |

Duyệt trang theo vai trò + axe trong cùng run: 76/76 lượt PASS (5 vai trò × route chính × 375/768/1024/1440px), 0 vi phạm axe serious/critical, cổng axe đang chặn (`UAT_AXE_GATE`). Nguồn: `uat-evidence/responsive-summary.md`.

## Hai khoảng hở đã đóng

Cả hai được phát hiện ở run của commit `8423585` ([run 39225074368](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39225074368), cũng toàn bộ `success`), và được `4a08bb4` xử lý.

1. **Flow 04 — nhánh workflow.** Ở `8423585`, file kết quả ghi "No ready workflow item with an open primary task: workflow progression was not exercised", vì bước 6 chỉ chạy khi tình cờ có hạng mục workflow sẵn sàng. Nay bước 6 tự dựng fixture trên dự án do Team Leader quản lý: khởi tạo workflow (`workflow_instantiate_project_service`), đặt hạng mục A (task chính mở) chặn hạng mục B (`finish_to_start`, B ở trạng thái `blocked`). Kịch bản kiểm: khi task ở `review` thì A chưa hoàn thành và B vẫn `blocked`; sau khi Team Leader duyệt `done`, A thành `completed` và B chuyển `ready`. Thiếu workflow/hạng mục thì **FAIL**, không còn bỏ qua.
   - Dẫn chứng ở `4a08bb4`: `flow04-results.json` PASS, không còn ghi chú, bước "6. Approving the linked task completed its workflow item and unlocked the next item (blocked -> ready)".
2. **Flow 01 — phòng ban.** Ở `8423585`, phòng ban được gán bằng `PATCH /admin/projects/:id` vì wizard chưa có trường. Nay wizard tạo dự án có thêm trường "Phòng ban phụ trách" (bước 2, tùy chọn, `apps/web/components/phase3/project-create-wizard-dialog.tsx`); Flow 01 chọn phòng ban trên giao diện và kiểm `projects.department_id` trong DB, bước gán bằng API đã bỏ.
   - Dẫn chứng ở `4a08bb4`: `flow01-results.json` PASS, không còn ghi chú "design gap", bước "2. Admin created the project through the wizard: customer + Team Leader + department + status stored".

Hai thay đổi này cũng đã được chạy PASS cục bộ trên Supabase disposable trước khi đẩy lên CI.

## Chưa làm

- Staging/production UAT (xem `UI_BACKEND_GAPS.md`).
- Kịch bản từ chối/yêu cầu sửa ở các luồng ngoài Flow 04, và 4 hotspot FALLBACK trong prototype (G-10).
