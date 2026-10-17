# Figma ↔ Code Screen Mapping

Nguồn: file Figma "Thiết Kế WebsiteApp PGS" (`wjMjtxfqT7Jot06fCojjGJ`), đọc qua figma-console (chỉ đọc), 2026-10-17.
Code: branch `feat/pgs-audit-ux-uat`, HEAD `a67c4e0`.

## Số liệu đo được

| Hạng mục                                             | Figma                                | Code                                 |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Màn Desktop 1440 (frame cấp 1 trong section vai trò) | 99                                   | 99 `page.tsx` trong `apps/web/app`   |
| Tablet / Mobile                                      | ~99 mỗi loại + "Màn tự vẽ" 768 / 375 | responsive CSS, không có route riêng |
| Component / component set                            | 187 / 18                             | `apps/web/components/ui`             |

Hai con số 99 trùng nhau về tổng nhưng **chưa được đối chiếu từng frame**. `docs/UI_FIGMA_COVERAGE.md` cũ chỉ phủ 52 ngữ cảnh PNG, không phải 99 frame hiện tại.

## Theo nhóm vai trò

| Figma section (Desktop) | Frame | Route prefix                                                                                              | Page trong code        | Trạng thái                                            |
| ----------------------- | ----- | --------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| Công khai & Xác thực    | 8     | `/auth/*`, `/account/*`                                                                                   | 8 (6 auth + 2 account) | Số khớp; chưa đối chiếu từng frame                    |
| Admin (5 section)       | 32    | `/app/admin/*`                                                                                            | 33                     | Code nhiều hơn 1 (chưa xác định page nào thiếu frame) |
| Trưởng nhóm             | 11    | `/app/team-leader/*`                                                                                      | 11                     | Số khớp                                               |
| Nhân viên               | 10    | `/app/employee/*`                                                                                         | 8                      | Lệch 2: cần xác định frame nào dùng route dùng chung  |
| Kế toán                 | 15    | `/app/accountant/*`                                                                                       | 15                     | Số khớp                                               |
| Khách hàng              | 11    | `/app/client/*`                                                                                           | 11                     | Số khớp                                               |
| Dùng chung              | 9     | `/app/projects/*` (6), `/app/chat`, `/app/leave`, `/app/attendance`, `/app/notifications`, `/app/profile` | 11                     | Lệch 2                                                |
| Tài liệu theo phòng ban | 3     | `/app/*/documents`                                                                                        | 4                      | Chưa đối chiếu                                        |

Cách đếm: Figma = số frame cấp 1 trong mỗi section vai trò (Admin = 1+8+6+8+9). Code = glob `apps/web/app/**/page.tsx` (Admin 33, Kế toán 15, Khách hàng 11, Trưởng nhóm 11, Nhân viên 8, dùng chung 11, auth+account 8, `/app` và `/` 2 = 99).

## Bảng ánh xạ đầy đủ (cột yêu cầu)

`Figma Page | Figma Frame | Role | Frontend Route | Component | API | Workflow ID | Prototype Connected | Real Interaction Verified | Status`

Bảng cấp frame chưa lập được vì chưa chạy được app + chưa export tên 99 frame. Bước tiếp theo: xuất tên frame bằng figma-console và ghép với `scripts/verify-local-ui-route-matrix.mjs`. Trạng thái toàn bộ cột "Real Interaction Verified" hiện là **CHƯA KIỂM CHỨNG** (xem `END_TO_END_UAT.md`).
