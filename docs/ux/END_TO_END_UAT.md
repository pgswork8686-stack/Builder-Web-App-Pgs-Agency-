# End-to-End UAT

> Phạm vi: toàn bộ kết quả dưới đây chạy trên Supabase **disposable** cấp trong runner CI, với tài khoản seed tổng hợp. **Không phải UAT trên staging hay production.** Bảng đầy đủ (run, artifact, giờ chạy) nằm ở `docs/release/RELEASE_EVIDENCE_MATRIX.md`.

## Kết quả CI mới nhất: commit `429f111`

Commit: `429f111a2cc6405425ef0cb8fcb10c36d098ceb7` — `test(uat): Flow 08 respects the assigned-task guard when revoking access` (nhánh `feat/pgs-audit-ux-uat`, 2026-10-20).

| Check                         | Run                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Database-backed UAT + browser | success — [run 39362211127](https://github.com/pgswork8686-stack/Builder-Web-App-Pgs-Agency-/actions/runs/39362211127) |
| Quality gates                 | success — run 39362211107 (push), 39362214906 (pull_request)                                                           |
| API production container      | success — cùng hai run; kiểm `/health` trả `release.sha` đúng commit                                                   |
| cPanel Node 22 artifact       | success — cùng hai run; kiểm `release.sha` khớp `DEPLOYMENT_INFO.txt`                                                  |
| Artifact bằng chứng           | `uat-evidence` id 12237839838 (20,5 MB): JSON từng flow, 283 ảnh, `responsive-results.json`                            |

### E2E liên vai trò 01–08

Mỗi luồng thao tác UI bằng Playwright, truy vấn DB (pg) sau từng bước để xác nhận bản ghi và notification. Số bước lấy từ `uat-evidence/flowNN/flowNN-results.json` của run trên.

| Luồng | Script                                                                  | Kết quả | Số bước           | Ghi chú trong file kết quả       |
| ----- | ----------------------------------------------------------------------- | ------- | ----------------- | -------------------------------- |
| 01    | `scripts/uat-flow01-project-init.mjs`                                   | PASS    | 12                | không có                         |
| 02    | `scripts/uat-flow02-task-assignment.mjs`                                | PASS    | 7                 | Dùng dự án do Flow 01 tạo        |
| 03    | `scripts/uat-flow03-task-execution.mjs`                                 | PASS    | 8                 | Dùng task do Flow 02 tạo         |
| 04    | `scripts/uat-flow04-internal-review.mjs`                                | PASS    | 9                 | không có                         |
| 05    | `scripts/uat-flow05-client-acceptance.mjs`, `scripts/uat-flow05-ui.mjs` | PASS    | 13 (API) + 9 (UI) | không có                         |
| 06    | `scripts/uat-flow06-finance.mjs`                                        | PASS    | 8                 | không có                         |
| 07    | `scripts/uat-flow07-handover-close.mjs`                                 | PASS    | 9                 | không có                         |
| 08    | `scripts/uat-flow08-resilience.mjs`                                     | PASS    | 5                 | không có (luồng mới, 2026-10-20) |

Flow 08 phủ các nhánh lỗi: token rỗng/sai (401, không lộ dữ liệu), mất kết nối API → thông báo lỗi + nút "Thử lại" → phục hồi, hết phiên → về trang đăng nhập → đăng nhập lại, và thu hồi quyền khi đang đăng nhập (chặn xóa thành viên còn việc 409 `PROJECT_MEMBER_HAS_ASSIGNED_TASKS`, sau khi giao lại việc và thu hồi thì API từ chối 403/404, DB không đổi).

### Duyệt trang theo vai trò + axe

260 lượt PASS, 0 lượt lỗi (4 độ rộng 375/768/1024/1440 px): admin 18 route, team leader 11, employee 11, accountant 14, client 11. Cổng axe chặn serious/critical (`UAT_AXE_GATE`). Trước đây chỉ 76 lượt (accountant 1 route); mở rộng đã phát hiện và buộc sửa 70 lượt lỗi (`docs/release/FINAL_GAP_AUDIT.md` F-03, F-04). Chưa phủ: route động có id (được duyệt bên trong các flow), trang đăng nhập/landing, thao tác Kanban bằng bàn phím, kích thước vùng chạm.

## Lịch sử các khoảng hở đã đóng

1. **Flow 04 — nhánh workflow** (đóng ở `4a08bb4`): bước 6 tự dựng fixture và kiểm `blocked → ready` khi duyệt task; thiếu fixture thì FAIL, không bỏ qua.
2. **Flow 01 — phòng ban** (đóng ở `4a08bb4`): wizard có trường "Phòng ban phụ trách"; Flow 01 chọn trên giao diện và kiểm `projects.department_id`.
3. **Cổng responsive chỉ 76 lượt** (đóng ở `26c8ce1`/`429f111`): mở rộng thành 260 lượt và sửa lỗi phát hiện được.
4. **Nhánh lỗi chưa kiểm chứng** (đóng ở `429f111`): Flow 08.

## Chưa làm

- Staging/production UAT (xem `docs/release/PRODUCTION_PREFLIGHT_CHECKLIST.md`).
- Từ chối/yêu cầu sửa của khách hàng ở nhiều khách hàng khác nhau; cô lập khách hàng cho mọi route client.
- Prototype tablet/mobile trong Figma (G-06).
