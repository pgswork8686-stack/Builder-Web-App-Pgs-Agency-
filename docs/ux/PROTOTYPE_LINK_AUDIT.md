# Prototype Link Audit

Đo bằng figma-console trên page "09 Mẫu tương tác". Số đo gốc 2026-10-17; cập nhật ngày 2026-10-20 ở mục "Thay đổi 2026-10-20". File Figma: `Thiết Kế WebsiteApp PGS` (`wjMjtxfqT7Jot06fCojjGJ`).

## Đã kết nối (đo 2026-10-17)

- 12 flow độc lập FLOW-01..FLOW-12 + `FLOW HUB`: tổng 50 reaction, trỏ tới 39 frame đích.
- Reaction theo flow: F01=4, F02=2, F03=4, F04=3, F05=3, F06=2, F07=4, F08=3, F09=3, F10=3, F11=3, F12=4; 12 reaction nằm ngoài section FLOW (nút ở FLOW HUB).
- Tất cả đích đều là frame bản 1440.

## Đã bổ sung (2026-10-17) — 7 luồng liên vai trò

Thêm 7 section `X-FLOW-01..07` ở cuối page 09 (bản sao frame 1440 + hotspot ON_CLICK → NAVIGATE). FLOW cũ không bị sửa. Tổng reaction page 09: 50 → 87. Mỗi flow có starting point đặt tên; frame cuối trỏ về FLOW HUB.

| Flow                                     | Bước | Hotspot khớp nút theo chữ | Hotspot đặt tạm (FALLBACK) lúc đo 2026-10-17 |
| ---------------------------------------- | ---- | ------------------------- | -------------------------------------------- |
| X-FLOW-01 Admin tạo dự án → TL           | 6    | 6                         | 0                                            |
| X-FLOW-02 TL giao task → Employee        | 5    | 4                         | 1 (B3 Kanban → Chi tiết task)                |
| X-FLOW-03 Employee thực hiện → gửi duyệt | 4    | 3                         | 1 (B3 → Đơn cần duyệt)                       |
| X-FLOW-04 TL kiểm duyệt                  | 4    | 3                         | 1 (B2 → Chi tiết task)                       |
| X-FLOW-05 Client nghiệm thu              | 5    | 5                         | 0                                            |
| X-FLOW-06 Accountant tài chính           | 8    | 8                         | 0                                            |
| X-FLOW-07 Admin hoàn thành               | 5    | 4                         | 1 (B4 → Tệp dự án)                           |

## Thay đổi 2026-10-20 (làm trực tiếp trong Figma)

1. **Bốn hotspot FALLBACK được đặt lại lên đúng thành phần** (đã chụp hoặc đọc lại kích thước/tọa độ sau khi sửa; mỗi hotspot ghi `pluginData` `anchor` và `fallbackResolved`):

   | Flow / bước  | Thành phần mới được gắn                             | Hộp bao (x, y, rộng, cao) |
   | ------------ | --------------------------------------------------- | ------------------------- |
   | X-FLOW-02 B3 | thẻ task T-112 trên Kanban                          | 288, 337, 192×114         |
   | X-FLOW-03 B3 | biểu tượng chuông thông báo trên topbar             | 1192, 21, 36×36           |
   | X-FLOW-04 B2 | thẻ task T-101 (cột "Chờ duyệt") trên Kanban        | 864, 352, 250×114         |
   | X-FLOW-07 B4 | nhãn "Chờ tài liệu" của dự án DA_03 trong danh sách | 1262, 412, 69×26          |

2. **Flow "Hoàn thành dự án" (G-07)**: thêm hai khung `X-FLOW-07 · B3a` (chưa đủ điều kiện: "1 công việc chưa hoàn thành", nút "Xác nhận hoàn tất" bị khóa) và `B3b` (đủ điều kiện). Nội dung chữ lấy đúng từ `project-lifecycle-dialogs.tsx` (Flow 07 đang chạy). Hotspot "Nghiệm thu" ở B3 nay mở B3b; "Hủy" quay B3; "Xác nhận hoàn tất" ở B3b sang B4 (Dự án hoàn thành). B3a không có đường vào bằng nút vì kịch bản mặc định là đường thành công — đây là khung minh họa trạng thái bị chặn.

**Chưa được nhà thiết kế duyệt**: vị trí các hotspot mới và hai khung hộp thoại; chưa chạy chế độ Present để bấm thử cả luồng bằng tay.

## Chưa kết nối

1. Khoảng 60/99 màn desktop không là đích của reaction nào.
2. Toàn bộ Tablet (768) và Mobile (375): **0 reaction** dù đủ 99 khung mỗi cỡ (G-06). Cần nhà thiết kế nhân bản liên kết; không có thiết kế nguồn thiếu.
3. Nhánh Từ chối của Team Leader (Flow 04), Upload lỗi, Validation → sửa trong luồng liên vai trò (chỉ có đường thành công, trừ hai nhánh modal của Client ở X-FLOW-05).
4. Chưa kiểm loại hành động của từng reaction (điều hướng hay overlay) ngoài các hotspot mới.

## Việc còn lại trong Figma

- Nhà thiết kế duyệt vị trí các hotspot mới và hai khung hộp thoại.
- Nối các nút Create/Save/Cancel/Back/Approve/Reject trên các frame chính.
- Nhân bản kết nối cho tablet và mobile.
