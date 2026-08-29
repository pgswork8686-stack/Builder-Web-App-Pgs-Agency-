-- Production audit hardening: additive RBAC/data-scope foundation, safe archive
-- semantics, and indexes reported by the Supabase performance advisor.

ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'archived';

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_scope TEXT NOT NULL CHECK (default_scope IN ('global', 'department', 'own', 'client')),
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CHECK ((active AND revoked_at IS NULL) OR (NOT active))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_active_user_uidx
  ON public.user_role_assignments(user_id)
  WHERE active;
CREATE INDEX IF NOT EXISTS user_role_assignments_role_id_idx
  ON public.user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_department_id_idx
  ON public.user_role_assignments(department_id)
  WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_role_assignments_assigned_by_idx
  ON public.user_role_assignments(assigned_by)
  WHERE assigned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
  ON public.role_permissions(permission_id);

INSERT INTO public.roles (key, name, description, default_scope)
VALUES
  ('admin', 'Super Admin', 'Toàn quyền hệ thống', 'global'),
  ('team_leader', 'Trưởng phòng', 'Quản lý dữ liệu trong phòng ban được giao', 'department'),
  ('employee', 'Nhân viên', 'Thao tác trên công việc được giao', 'own'),
  ('accountant', 'Kế toán', 'Quản lý nghiệp vụ tài chính', 'global'),
  ('client', 'Khách hàng', 'Chỉ xem dữ liệu đã được chia sẻ', 'client')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_scope = EXCLUDED.default_scope,
  updated_at = now();

INSERT INTO public.permissions (key, module, action, description)
VALUES
  ('system.manage', 'system', 'manage', 'Quản trị cấu hình toàn hệ thống'),
  ('users.manage', 'users', 'manage', 'Quản lý tài khoản và vai trò'),
  ('projects.read', 'projects', 'read', 'Xem dự án trong data scope'),
  ('projects.create', 'projects', 'create', 'Tạo dự án trong data scope'),
  ('projects.update', 'projects', 'update', 'Cập nhật dự án trong data scope'),
  ('projects.archive', 'projects', 'archive', 'Lưu trữ dự án trong data scope'),
  ('projects.manage_members', 'projects', 'manage_members', 'Quản lý thành viên dự án'),
  ('projects.approve', 'projects', 'approve', 'Duyệt dự án'),
  ('tasks.read', 'tasks', 'read', 'Xem công việc được phép'),
  ('tasks.create', 'tasks', 'create', 'Tạo công việc'),
  ('tasks.assign', 'tasks', 'assign', 'Giao công việc'),
  ('tasks.update_status', 'tasks', 'update_status', 'Cập nhật trạng thái công việc'),
  ('tasks.review', 'tasks', 'review', 'Duyệt hoặc yêu cầu sửa công việc'),
  ('files.upload', 'files', 'upload', 'Tải tệp lên'),
  ('files.approve', 'files', 'approve', 'Duyệt tệp'),
  ('files.share_customer', 'files', 'share_customer', 'Chia sẻ tệp đã duyệt cho khách hàng'),
  ('comments.create', 'comments', 'create', 'Bình luận trong phạm vi được phép'),
  ('attendance.self', 'attendance', 'self', 'Chấm công và xem dữ liệu của chính mình'),
  ('attendance.review', 'attendance', 'review', 'Xem và duyệt chấm công trong data scope'),
  ('finance.manage', 'finance', 'manage', 'Quản lý tài chính'),
  ('portal.read_shared', 'portal', 'read_shared', 'Xem dữ liệu khách hàng được chia sẻ')
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

WITH grants(role_key, permission_key) AS (
  VALUES
    ('admin', 'system.manage'), ('admin', 'users.manage'),
    ('admin', 'projects.read'), ('admin', 'projects.create'),
    ('admin', 'projects.update'), ('admin', 'projects.archive'),
    ('admin', 'projects.manage_members'), ('admin', 'projects.approve'),
    ('admin', 'tasks.read'), ('admin', 'tasks.create'), ('admin', 'tasks.assign'),
    ('admin', 'tasks.update_status'), ('admin', 'tasks.review'),
    ('admin', 'files.upload'), ('admin', 'files.approve'),
    ('admin', 'files.share_customer'), ('admin', 'comments.create'),
    ('admin', 'attendance.self'), ('admin', 'attendance.review'),
    ('admin', 'finance.manage'), ('admin', 'portal.read_shared'),
    ('team_leader', 'projects.read'), ('team_leader', 'projects.create'),
    ('team_leader', 'projects.update'), ('team_leader', 'projects.archive'),
    ('team_leader', 'projects.manage_members'), ('team_leader', 'projects.approve'),
    ('team_leader', 'tasks.read'), ('team_leader', 'tasks.create'),
    ('team_leader', 'tasks.assign'), ('team_leader', 'tasks.update_status'),
    ('team_leader', 'tasks.review'), ('team_leader', 'files.upload'),
    ('team_leader', 'files.approve'), ('team_leader', 'files.share_customer'),
    ('team_leader', 'comments.create'), ('team_leader', 'attendance.self'),
    ('team_leader', 'attendance.review'),
    ('employee', 'projects.read'), ('employee', 'tasks.read'),
    ('employee', 'tasks.update_status'), ('employee', 'files.upload'),
    ('employee', 'comments.create'), ('employee', 'attendance.self'),
    ('accountant', 'projects.read'), ('accountant', 'finance.manage'),
    ('accountant', 'attendance.self'),
    ('client', 'portal.read_shared')
)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM grants g
JOIN public.roles r ON r.key = g.role_key
JOIN public.permissions p ON p.key = g.permission_key
ON CONFLICT DO NOTHING;

INSERT INTO public.user_role_assignments(user_id, role_id, department_id)
SELECT p.id, r.id, ep.department_id
FROM public.profiles p
JOIN public.roles r ON r.key = p.role::text
LEFT JOIN public.employee_profiles ep ON ep.user_id = p.id
WHERE p.role IS NOT NULL
  AND p.account_status = 'active'
ON CONFLICT (user_id) WHERE active DO NOTHING;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT;

UPDATE public.projects p
SET department_id = ep.department_id
FROM public.employee_profiles ep
WHERE p.department_id IS NULL
  AND ep.user_id = p.project_manager_user_id
  AND ep.department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_department_created_idx
  ON public.projects(department_id, created_at DESC, id DESC)
  WHERE department_id IS NOT NULL;

-- Foreign-key indexes reported by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS company_work_calendar_events_approved_by_idx ON public.company_work_calendar_events(approved_by);
CREATE INDEX IF NOT EXISTS company_work_calendar_events_created_by_idx ON public.company_work_calendar_events(created_by);
CREATE INDEX IF NOT EXISTS company_work_calendar_events_updated_by_idx ON public.company_work_calendar_events(updated_by);
CREATE INDEX IF NOT EXISTS employee_compensation_history_created_by_idx ON public.employee_compensation_history(created_by_user_id);
CREATE INDEX IF NOT EXISTS employee_compensation_history_updated_by_idx ON public.employee_compensation_history(updated_by_user_id);
CREATE INDEX IF NOT EXISTS employee_monthly_payroll_reviews_updated_by_idx ON public.employee_monthly_payroll_reviews(updated_by_user_id);
CREATE INDEX IF NOT EXISTS project_service_items_created_by_idx ON public.project_service_items(created_by);
CREATE INDEX IF NOT EXISTS project_service_items_source_delivery_idx ON public.project_service_items(source_delivery_item_id);
CREATE INDEX IF NOT EXISTS project_service_items_updated_by_idx ON public.project_service_items(updated_by);
CREATE INDEX IF NOT EXISTS project_workflow_item_dependencies_overridden_by_idx ON public.project_workflow_item_dependencies(overridden_by);
CREATE INDEX IF NOT EXISTS project_workflow_item_dependencies_successor_idx ON public.project_workflow_item_dependencies(successor_stage_item_id);
CREATE INDEX IF NOT EXISTS project_workflow_stage_dependencies_overridden_by_idx ON public.project_workflow_stage_dependencies(overridden_by);
CREATE INDEX IF NOT EXISTS project_workflow_stage_dependencies_successor_idx ON public.project_workflow_stage_dependencies(successor_stage_id);
CREATE INDEX IF NOT EXISTS service_categories_created_by_idx ON public.service_categories(created_by);
CREATE INDEX IF NOT EXISTS service_categories_updated_by_idx ON public.service_categories(updated_by);
CREATE INDEX IF NOT EXISTS service_delivery_items_created_by_idx ON public.service_delivery_items(created_by);
CREATE INDEX IF NOT EXISTS service_delivery_items_updated_by_idx ON public.service_delivery_items(updated_by);
CREATE INDEX IF NOT EXISTS service_department_assignments_created_by_idx ON public.service_department_assignments(created_by);
CREATE INDEX IF NOT EXISTS service_department_assignments_updated_by_idx ON public.service_department_assignments(updated_by);
CREATE INDEX IF NOT EXISTS service_team_assignments_created_by_idx ON public.service_team_assignments(created_by);
CREATE INDEX IF NOT EXISTS service_team_assignments_updated_by_idx ON public.service_team_assignments(updated_by);
CREATE INDEX IF NOT EXISTS workflow_template_item_dependencies_successor_idx ON public.workflow_template_item_dependencies(successor_stage_item_id);
CREATE INDEX IF NOT EXISTS workflow_template_stage_dependencies_successor_idx ON public.workflow_template_stage_dependencies(successor_stage_id);
CREATE INDEX IF NOT EXISTS workflow_templates_created_by_idx ON public.workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS workflow_templates_published_by_idx ON public.workflow_templates(published_by);
CREATE INDEX IF NOT EXISTS workflow_templates_updated_by_idx ON public.workflow_templates(updated_by);

DROP INDEX IF EXISTS public.uidx_project_service_items_delivery_source;

-- Production attendance perimeter requested for the PGS Agency office.
-- Distance remains calculated and enforced by the backend/RPC; the browser only
-- supplies the raw GPS reading and accuracy metadata.
UPDATE public.attendance_settings
SET office_latitude = 20.9840365,
    office_longitude = 105.7700707,
    location_radius_meters = 150,
    location_required = TRUE,
    updated_at = now();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.roles, public.permissions, public.role_permissions, public.user_role_assignments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles, public.permissions, public.role_permissions, public.user_role_assignments
  TO service_role;
