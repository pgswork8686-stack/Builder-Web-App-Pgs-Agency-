# 03 · BUSINESS CONFLICT REGISTER

Không mục nào được tự chuẩn hóa theo mã nguồn cũ. Trạng thái `PENDING` = chờ PGS quyết định.

| Mã | Nguồn 1 | Nguồn 2 | Code hiện tại | Rủi ro | Đề xuất | Trạng thái |
|---|---|---|---|---|---|---|
| CX01 | Baseline PGS: geofence 50 m | Phiếu nghiệm thu / hiện trạng: 150 m | 150 m (migration + system_settings) | Chấm công sai quy định | Đổi giá trị canonical về 50 m bằng migration **sau khi PGS duyệt**; UI đọc bán kính từ backend, không hardcode | PENDING |
| CX02 | Baseline: WFH duyệt trước, chấm công không geofence | Hiện trạng: không có | Không có bảng, API hay UI | Nhân sự WFH không chấm được công hợp lệ | Backend: bảng `wfh_requests`, endpoint tạo/duyệt, nhánh check-in WFH trong `attendance.service`, kèm migration và test. UI: tab WFH ở Đơn từ, duyệt trong Cần xử lý | PENDING (backend gap) |
| CX03 | Baseline: việc / duyệt nội bộ / công khai / khách nghiệm thu là 4 khái niệm độc lập | Hiện trạng: `review → done` do Trưởng phòng “nghiệm thu” | Không có bảng phiên bản/công khai/nghiệm thu | Khách nghiệm thu sai phiên bản; Trưởng phòng “nghiệm thu” thay khách | V2 UI đổi nhãn đúng nghĩa: `review` = **Chờ duyệt nội bộ**, `done` = **Hoàn tất nội bộ**. Phần phiên bản/công khai/nghiệm thu khách cần backend mới (bảng `deliverable_versions`, `deliverable_feedback`, `deliverable_acceptances`) | PENDING (backend gap) |
| CX05 | Phép cộng 1 ngày/tháng, chuyển tiếp | Có tài liệu hiểu là “mỗi tháng chỉ nghỉ 1 ngày” | Có `leave_balances` + điều chỉnh | Từ chối đơn sai | Không chặn theo tháng; chỉ hiện số dư | PENDING |
| CX07 | Baseline 78 điểm vào | Hiện trạng có thêm Chat, Tự động hóa, Lịch họp khách, Hỗ trợ khách, Đăng ký tài khoản | Đều có route/API | Mất tính năng đang dùng | Giữ hết; Hỗ trợ tách khỏi góp ý sản phẩm | PENDING |
| CX08 | Lương = lương tháng / **24** × công | Code: chia **số ngày công chuẩn từ lịch làm việc** | `payroll.service.ts` | Sai lương | Hiện công thức đang chạy thật trên UI kèm nhãn “chờ CX08”; đổi công thức chỉ sau duyệt + migration/test | PENDING |
| D01 | Quyền Trưởng phòng tạo/sửa khách | Hiện trạng đang mở cho Trưởng phòng | Mở | Trái quyết định chưa duyệt | Giữ nguyên hành vi đang chạy (đã được chủ dự án yêu cầu ngày 12/11), ghi nhận để PGS chốt | PENDING |
