# CHECKPOINT — PGS Hub V2 Full Role-Based Rebuild

Nhánh: `feat/pgs-hub-v2-full-role-redesign` (đã đẩy lên GitHub, **chưa** mở PR, **không** deploy)

| Phase | Trạng thái | Bằng chứng |
|---|---|---|
| 0 — Kiểm kê | DONE (bản đầu) | `01_REPO_AUDIT.md`, `02_ROLE_SCREEN_INVENTORY.csv` (100 route), `03_BUSINESS_CONFLICT_REGISTER.md`, `06_DATA_CONTRACT_MATRIX.md` (222 endpoint). Thiếu `04_IA_NAVIGATION.md`, `05_USER_FLOW_SPEC.md` dạng riêng (IA nằm trong `role-navigation.ts`; luồng F01–F10 ở gói thiết kế Figma) |
| 1 — Design System + App Shell | DONE (chờ duyệt bằng ảnh) | Màu tím lavender toàn web (2.494 mã màu + logo/nền auth), phông Be Vietnam Pro, sidebar V2, `ModuleTabs`, mobile sidebar; Button/Card/Badge/Table/Kpi/Widget theo V2; làm nhẹ chữ toàn web (font-black/extrabold, uppercase) |
| 2 — Luồng xuyên vai trò | IN PROGRESS | Đổi nhãn đúng nghĩa CX03: `review` = Chờ duyệt nội bộ, `done` = Hoàn tất nội bộ, “Hoàn thành dự án” thay “Nghiệm thu” ở phía nội bộ |
| 3 — Màn theo vai trò | IN PROGRESS | Trưởng phòng › Hôm nay làm lại hoàn toàn (dữ liệu thật `/team-leader/dashboard`); 4 dashboard còn lại đổi qua component dùng chung |
| 4 — Điện thoại/máy tính bảng | NOT STARTED | — |
| 5 — QA | PARTIAL | `tsc` đạt · `vitest` web 95/95 · `eslint` file đã sửa đạt · `next build` đạt (12/11). **Chưa có ảnh chụp UI thật**: kết nối Chrome DevTools bị ngắt; xem thử cục bộ qua proxy chỉ-đọc (`scratchpad/api-proxy.js`) cần phiên đăng nhập test |
| 6 — PR | NOT STARTED | — |

## Bị chặn bởi quyết định / backend

| Mã | Cần gì | Ai duyệt |
|---|---|---|
| CX01 | Migration đổi bán kính 150 → 50 m | PGS |
| CX02 | Migration + API WFH (`wfh_requests`, nhánh check-in không geofence) | PGS + kỹ thuật |
| CX03 | Migration + API phiên bản sản phẩm, công khai, góp ý, nghiệm thu khách | PGS + kỹ thuật |
| CX08 | Công thức lương 24 công thay vì số ngày công chuẩn theo lịch | PGS |

Không có migration nào được áp lên production trong nhánh này.
