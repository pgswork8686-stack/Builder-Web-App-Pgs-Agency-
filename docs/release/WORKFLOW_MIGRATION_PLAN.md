# PGS HUB — KẾ HOẠCH & TÀI LIỆU MIGRATION WORKFLOW ENGINE V1

`
================================================================================

WORKFLOW ENGINE V1 MIGRATION MANIFEST (SOURCE-ONLY)
================================================================================

MIGRATION FILE: supabase/migrations/20260820120000_workflow_engine_v1_foundation.sql
STATUS: COMMITTED TO SOURCE ONLY (CHƯA VÀ KHÔNG APPLY TRÊN PRODUCTION DB)
TARGET DATABASE: umtgfaqjoqbsdzwpqizq (BẢO VỆ NGUYÊN VẸN)
ROLLBACK PLAN: DROP TABLE IF EXISTS workflow_approval_requests, project_workflow_task_links, project_workflow_stage_items, project_workflow_stages, project_workflows, workflow_template_item_dependencies, workflow_template_stage_dependencies, workflow_template_stage_items, workflow_template_stages, workflow_templates CASCADE;
================================================================================

`

## 1. MỤC TIÊU & CẤU TRÚC BẢNG (TABLES)

1. workflow_templates: Định nghĩa quy trình chuẩn theo từng Dịch vụ (Versioned: draft ➔ published ➔ archived, immutable khi published).
2. workflow_template_stages: Phân chia các giai đoạn trong quy trình mẫu (sort_order, sla_hours, is_required).
3. workflow_template_stage_items: Ánh xạ các Hạng mục triển khai chuẩn (Service Delivery Items) vào từng giai đoạn.
4. workflow_template_stage_dependencies: Ràng buộc thứ tự thực hiện giữa các giai đoạn (Finish-to-Start DAG, Cycle prevention).
5. workflow_template_item_dependencies: Ràng buộc thứ tự thực hiện giữa các hạng mục.
6. project_workflows: Snapshot quy trình thực tế khi dự án được gắn dịch vụ.
7. project_workflow_stages: Các giai đoạn thực thi trong dự án (locked ➔ ready ➔ in_progress ➔ completed).
8. project_workflow_stage_items: Các hạng mục thực thi thực tế trong dự án.
9. project_workflow_task_links: Liên kết các Task công việc duy nhất vào hạng mục quy trình.
10. workflow_approval_requests: Yêu cầu phê duyệt nội bộ và từ phía Khách hàng.

## 2. BẢO MẬT & PHÂN QUYỀN (RLS & SECURITY)

- Bật Row Level Security (RLS) trên toàn bộ 10 bảng mới.
- Thu hồi toàn bộ quyền từ PUBLIC, non, uthenticated.
- Chỉ cấp quyền cho service_role để NestJS API điều phối tập trung.
- Tránh SECURITY DEFINER không an toàn.
