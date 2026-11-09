# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Nhân sự nội bộ PGS Agency (admin, trưởng nhóm, nhân viên, kế toán) dùng hằng ngày, **nhiều trên điện thoại** (chấm công, xin nghỉ, duyệt đơn, nhận việc) lẫn máy tính. Khách hàng dùng cổng riêng chỉ để xem dự án, duyệt sản phẩm, hóa đơn và gửi yêu cầu hỗ trợ của công ty mình.

## Product Purpose
PGS Hub là hệ thống vận hành của PGS Agency: một nơi cho dự án, công việc, chấm công, nghỉ phép, hợp đồng, hóa đơn, thanh toán, lương và cổng khách hàng. Thành công là mỗi vai trò thấy đúng việc cần xử lý hôm nay và làm xong ngay trong một lượt.

## Positioning
Một nơi cho cả vận hành lẫn tài chính, theo quy trình riêng của PGS, thay vì ghép nhiều phần mềm chung.

## Operating Context
- Năm vai trò: admin, team_leader, employee, accountant, client; mỗi vai trò có dashboard và menu riêng, phân quyền bằng RLS Supabase.
- Chấm công bắt buộc vị trí: trong bán kính 150 m quanh văn phòng, ca 08:00–17:30.
- Chạy trên VPS riêng: web hub.pgsagency.vn, API api.pgsagency.vn (Next.js 16 + NestJS 11 + Supabase).

## Capabilities and Constraints
- Thiết kế gốc nằm ở Figma `wjMjtxfqT7Jot06fCojjGJ`; giao diện đang theo nhánh `figma-update` (chưa hợp vào `main`).
- 100% tiếng Việt, không nhãn tiếng Anh; không để từ đơn lẻ ở cuối dòng khi xuống dòng.
- Chỉ có giao diện sáng, không chế độ tối.
- Chưa làm Tablet/Mobile theo Figma (đã xác nhận người dùng dùng nhiều trên điện thoại, nên đây là khoảng trống lớn).
- Chưa quyết định: nội dung trang công khai; gửi email (SMTP).

## Brand Commitments
Tên PGS Agency / PGS Hub, logo PGS có sẵn trong `public/brand`. Phông Space Grotesk theo Figma.

## Evidence on Hand
Không có chứng thực, khách hàng hay số liệu thật để đưa vào giao diện. Dữ liệu `TEST_` và tài khoản `test.*` chỉ để kiểm thử và phải được dọn.

## Product Principles
1. Mỗi vai trò mở ra là thấy ngay việc cần xử lý.
2. Một luồng, một nơi: vận hành và tài chính dùng chung dữ liệu, không nhập lại.
3. Dùng được bằng một tay trên điện thoại.
4. Tiếng Việt rõ ràng, nhất quán số tiền, ngày, nhãn trạng thái.
5. Mỗi vai trò chỉ thấy dữ liệu của mình.

## Accessibility & Inclusion
Chưa có tiêu chuẩn bắt buộc. Cần đạt tối thiểu tương phản chữ 4.5:1 và vùng bấm 44px trên điện thoại (hai điểm đo đang thiếu).
