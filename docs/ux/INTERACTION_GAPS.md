# Interaction Gaps

| ID | Mức | Mô tả | Bằng chứng | Trạng thái |
|---|---|---|---|---|
| G-01 | P0 | Client Project Detail gọi `tasksApi.list` → API `projects/:id/tasks` trả 403 cho client (`tasks.service.ts:472`); `Promise.all` làm cả trang lỗi | `project-detail-view.tsx` nhánh `mode === "client"` | **ĐÃ SỬA** ở web: client không gọi tasks, ẩn tab Công việc và 2 thẻ KPI task/nhân sự. Chưa chạy E2E xác nhận |
| G-02 | P0 | Không có E2E liên vai trò 01–07 kiểm DB | Chỉ có UAT duyệt trang và `scripts/run-full-local-uat.mjs` | MỞ |
| G-03 | P1 | axe-core chỉ ghi nhận, không chặn: `entry.problems` không có lỗi axe | `scripts/uat-responsive-capture.mjs` | **ĐÃ SỬA**: serious/critical làm FAIL (tắt bằng `UAT_AXE_GATE=off`). CI sẽ đỏ cho tới khi sửa hết vi phạm |
| G-04 | P1 | `select-name`: nhiều `<select>` không nhãn | project-list-view (2 cái, ĐÃ SỬA); còn: notifications-center:543, service-catalog-view (4–5), chat-workspace (3), task-detail-view:175, automation-workspace (2), project-detail-view `Select` | MỘT PHẦN |
| G-05 | P1 | `color-contrast` | Chưa xác định nút/nội dung cụ thể; cần chạy UAT để lấy danh sách node | MỞ |
| G-06 | P1 | Prototype tablet/mobile 0 liên kết | Xem `PROTOTYPE_LINK_AUDIT.md` | MỞ |
| G-10 | P1 | 7 luồng liên vai trò chưa có prototype | page 09 | **ĐÃ THÊM** X-FLOW-01..07 (đường thành công); còn 4 hotspot FALLBACK và nhánh từ chối |
| G-07 | P2 | Thiếu flow "Hoàn thành dự án" trong Figma | | MỞ |
| G-08 | P2 | `docs/UI_FIGMA_COVERAGE.md` chỉ phủ 52 PNG, lỗi encoding (mojibake) | | MỞ |
| G-09 | P2 | Module chi phí, lương, tài liệu, ticket, cài đặt: PRODUCTION chưa deploy; staging chưa dựng (theo `UI_BACKEND_GAPS.md`) | | MỞ |