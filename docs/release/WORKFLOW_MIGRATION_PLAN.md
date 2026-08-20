# PGS HUB — KẾ HOẠCH & TÀI LIỆU MIGRATION WORKFLOW ENGINE V1

`
================================================================================

WORKFLOW ENGINE V1 MIGRATION MANIFEST (SOURCE-ONLY)
================================================================================

FOUNDATION MIGRATION: supabase/migrations/20260820120000_workflow_engine_v1_foundation.sql
HARDENING MIGRATION: supabase/migrations/20260820123000_workflow_engine_v1_hardening.sql
STATUS: COMMITTED TO SOURCE ONLY (CHƯA VÀ KHÔNG APPLY TRÊN PRODUCTION DB)
TARGET PRODUCTION DATABASE: umtgfaqjoqbsdzwpqizq (BẢO VỆ NGUYÊN VẸN — 0 WRITES)
PHASE 10 STATUS: NOT APPLIED
================================================================================

`

## 1. MỤC TIÊU & CẤU TRÚC 13 BẢNG (COMPLETE TABLE LIST)

1. workflow_templates: Định nghĩa quy trình chuẩn theo từng Dịch vụ (QTDV_xx, versioned, immutable khi published).
2. workflow_template_stages: Phân chia giai đoạn mẫu (GDQT_xx, sort_order, sla_hours, is_required).
3. workflow_template_stage_items: Ánh xạ Service Delivery Items vào từng giai đoạn.
4. workflow_template_stage_dependencies: Ràng buộc thứ tự thực hiện giữa các giai đoạn mẫu (Finish-to-Start DAG).
5. workflow_template_item_dependencies: Ràng buộc thứ tự thực hiện giữa các hạng mục mẫu.
6. project_workflows: Snapshot quy trình thực tế của dự án (QTDA_xx, decoupled từ template v2).
7. project_workflow_stages: Giai đoạn thực thi dự án (GDDA_xx: locked ➔ ready ➔ in_progress ➔ completed).
8. project_workflow_stage_items: Hạng mục thực thi thực tế trong dự án.
9. project_workflow_stage_dependencies: Snapshot runtime ràng buộc giai đoạn dự án.
10. project_workflow_item_dependencies: Snapshot runtime ràng buộc hạng mục dự án.
11. project_workflow_task_links: Liên kết Task công việc duy nhất (public.tasks) vào hạng mục quy trình.
12. workflow_approval_requests: Yêu cầu phê duyệt nội bộ và khách hàng.
13. workflow_audit_events: Lưu vết kiểm toán toàn diện (audit trail) cho mọi hành động trong quy trình.

## 2. BẢO MẬT & PHÂN QUYỀN (RLS & IMMUTABILITY)

- Bật Row Level Security (RLS) trên toàn bộ 13 bảng.
- Thu hồi toàn bộ quyền từ PUBLIC, anon, authenticated.
- Chỉ cấp quyền cho service_role để NestJS Backend điều phối an toàn.
- Mã nghiệp vụ (QTDV_xx, GDQT_xx, QTDA_xx, GDDA_xx) sinh tự động qua sequence và gắn trigger bất biến prevent_business_code_column_update().
- Function RPC workflow_create_template được đặt SECURITY INVOKER và SET search_path = public, pg_temp.
