# Prototype Link Audit

Đo bằng figma-console trên page "09 Mẫu tương tác", 2026-10-17. Chưa chỉnh sửa gì trong Figma.

## Đã kết nối

- 12 flow độc lập FLOW-01..FLOW-12 + `FLOW HUB`: tổng 50 reaction, trỏ tới 39 frame đích.
- Reaction theo flow: F01=4, F02=2, F03=4, F04=3, F05=3, F06=2, F07=4, F08=3, F09=3, F10=3, F11=3, F12=4; 12 reaction nằm ngoài section FLOW (nút ở FLOW HUB).
- Tất cả đích đều là frame bản 1440.

## Đã bổ sung (2026-10-17) — 7 luồng liên vai trò

Thêm 7 section `X-FLOW-01..07` ở cuối page 09 (bản sao frame 1440 + hotspot ON_CLICK → NAVIGATE, kiểu giống FLOW-xx). FLOW cũ không bị sửa. Tổng reaction page 09: 50 → 87. Mỗi flow có starting point đặt tên; frame cuối trỏ về FLOW HUB.

| Flow | Bước | Hotspot khớp nút theo chữ | Hotspot đặt tạm (FALLBACK) |
|---|---|---|---|
| X-FLOW-01 Admin tạo dự án → TL | 6 | 6 | 0 (nhưng B1 khớp mục sidebar, cần duyệt) |
| X-FLOW-02 TL giao task → Employee | 5 | 4 | 1 (B3 Kanban → Chi tiết task) |
| X-FLOW-03 Employee thực hiện → gửi duyệt | 4 | 3 | 1 (B3 → Đơn cần duyệt) |
| X-FLOW-04 TL kiểm duyệt | 4 | 3 | 1 (B2 → Chi tiết task) |
| X-FLOW-05 Client nghiệm thu | 5 | 5 | 0 |
| X-FLOW-06 Accountant tài chính | 8 | 8 | 0 |
| X-FLOW-07 Admin hoàn thành | 5 | 4 | 1 (B4 → Tệp dự án) |

Giới hạn: hotspot được đặt lên chữ có từ khóa gần nhất, **chưa được nhà thiết kế duyệt vị trí**; 4 hotspot FALLBACK nằm ở vị trí tạm và cần kéo sang đúng nút. Bản sao chưa có trạng thái Submit/Reject/modal: các luồng này chỉ điều hướng giữa màn hình, chưa mô phỏng Từ chối → quay lại Employee. Chưa phủ tablet/mobile.

## Chưa kết nối

1. Khoảng 60/99 màn desktop không là đích của reaction nào.
2. Toàn bộ Tablet (768/1024) và Mobile (375): 0 reaction.
3. Nhánh Từ chối/Yêu cầu sửa, Upload lỗi, Validation, Modal của luồng liên vai trò (chỉ có đường thành công).
4. Chưa kiểm: loại hành động của 50 reaction (điều hướng hay overlay), các trạng thái Submit/Approve/Reject, Upload thành công/lỗi, Validation → sửa, Loading → Data/Empty/Error, Modal mở → xác nhận/đóng.
5. Flow chưa có starting point đặt tên theo luồng liên vai trò.

## Việc cần làm trong Figma (chưa thực hiện; file là thiết kế đã duyệt)

- Duyệt lại vị trí 87-50=37 hotspot mới, sửa 4 hotspot FALLBACK.
- Nối các nút Create/Save/Cancel/Back/Approve/Reject và modal trên các frame chính.
- Nhân bản kết nối cho tablet và mobile.
- Thêm frame/flow "Hoàn thành dự án" nếu được duyệt.