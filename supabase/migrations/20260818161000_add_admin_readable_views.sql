-- ============================================================
-- Migration: Add Admin Readable PostgreSQL Views
-- Timestamp: 20260818161000_add_admin_readable_views.sql
-- Description: Creates human-readable views with business codes,
-- relation names, and Vietnamese display statuses for Supabase Table Editor.
-- ============================================================

-- 1. View: Account Approval Events (admin_account_approval_events)
CREATE OR REPLACE VIEW public.admin_account_approval_events
WITH (security_invoker = true)
AS
SELECT
  aae.id AS event_id,
  aae.approval_event_code,
  
  -- Target User info (using actual column target_user)
  aae.target_user AS target_user_id,
  tp.account_code AS target_account_code,
  tep.employee_code AS target_employee_code,
  COALESCE(tp.full_name, 'Người dùng ' || SUBSTRING(aae.target_user::text, 1, 8)) AS target_user_name,
  
  -- Actor info (using actual column actor)
  aae.actor AS actor_id,
  ap.account_code AS actor_account_code,
  aep.employee_code AS actor_employee_code,
  COALESCE(ap.full_name, 'Hệ thống') AS actor_name,
  
  -- Action & Display
  aae.action,
  CASE aae.action
    WHEN 'approve' THEN 'Phê duyệt'
    WHEN 'approved' THEN 'Đã duyệt'
    WHEN 'reject' THEN 'Từ chối'
    WHEN 'rejected' THEN 'Đã từ chối'
    WHEN 'reassign_role' THEN 'Đổi vai trò'
    WHEN 'delete' THEN 'Xóa tài khoản'
    ELSE aae.action
  END AS action_display,
  
  -- Previous & New Status
  aae.previous_status,
  CASE aae.previous_status
    WHEN 'pending' THEN 'Chờ duyệt'
    WHEN 'active' THEN 'Hoạt động'
    WHEN 'rejected' THEN 'Từ chối'
    ELSE aae.previous_status::text
  END AS previous_status_display,
  
  aae.new_status,
  CASE aae.new_status
    WHEN 'pending' THEN 'Chờ duyệt'
    WHEN 'active' THEN 'Hoạt động'
    WHEN 'rejected' THEN 'Từ chối'
    ELSE aae.new_status::text
  END AS new_status_display,
  
  -- Previous & New Role
  aae.previous_role,
  CASE aae.previous_role
    WHEN 'admin' THEN 'Quản trị viên (Admin)'
    WHEN 'team_leader' THEN 'Trưởng nhóm (Team Leader)'
    WHEN 'employee' THEN 'Nhân viên (Employee)'
    WHEN 'accountant' THEN 'Kế toán (Accountant)'
    WHEN 'client' THEN 'Khách hàng (Client)'
    ELSE aae.previous_role::text
  END AS previous_role_display,
  
  aae.new_role,
  CASE aae.new_role
    WHEN 'admin' THEN 'Quản trị viên (Admin)'
    WHEN 'team_leader' THEN 'Trưởng nhóm (Team Leader)'
    WHEN 'employee' THEN 'Nhân viên (Employee)'
    WHEN 'accountant' THEN 'Kế toán (Accountant)'
    WHEN 'client' THEN 'Khách hàng (Client)'
    ELSE aae.new_role::text
  END AS new_role_display,
  
  aae.notes,
  aae.created_at
FROM public.account_approval_events aae
LEFT JOIN public.profiles tp ON tp.id = aae.target_user
LEFT JOIN public.employee_profiles tep ON tep.user_id = aae.target_user
LEFT JOIN public.profiles ap ON ap.id = aae.actor
LEFT JOIN public.employee_profiles aep ON aep.user_id = aae.actor;

COMMENT ON VIEW public.admin_account_approval_events IS 'Readable view for account approval events with resolved names, business codes, and Vietnamese action displays.';

-- 2. View: Clients (admin_clients)
CREATE OR REPLACE VIEW public.admin_clients
WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  c.client_code,
  c.name AS client_name,
  c.code AS original_code,
  c.tax_code,
  c.email,
  c.phone,
  c.address,
  c.website,
  c.status,
  CASE WHEN c.status = 'active' THEN 'Đang hợp tác' ELSE 'Tạm dừng' END AS status_display,
  c.notes,
  c.created_at,
  c.updated_at
FROM public.client_companies c;

COMMENT ON VIEW public.admin_clients IS 'Readable view for client companies with KH_ business codes.';

-- 3. View: People / Employees (admin_people)
CREATE OR REPLACE VIEW public.admin_people
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  p.id AS account_id,
  p.account_code,
  ep.employee_code,
  COALESCE(p.full_name, 'Thành viên ' || SUBSTRING(p.id::text, 1, 8)) AS full_name,
  ep.job_title,
  
  -- Department
  d.id AS department_id,
  d.department_code,
  d.name AS department_name,
  
  -- Team
  t.id AS team_id,
  t.team_code,
  t.name AS team_name,
  
  -- Direct Manager / Reports To
  ep.reports_to_user_id,
  rep.employee_code AS reports_to_code,
  rp.full_name AS reports_to_name,
  
  -- Role
  p.role,
  CASE p.role
    WHEN 'admin' THEN 'Quản trị viên (Admin)'
    WHEN 'team_leader' THEN 'Trưởng nhóm (Team Leader)'
    WHEN 'employee' THEN 'Nhân viên (Employee)'
    WHEN 'accountant' THEN 'Kế toán (Accountant)'
    WHEN 'client' THEN 'Khách hàng (Client)'
    ELSE 'Chưa phân quyền'
  END AS role_display,
  
  -- Account Status
  p.account_status,
  CASE p.account_status
    WHEN 'pending' THEN 'Chờ duyệt'
    WHEN 'active' THEN 'Hoạt động'
    WHEN 'rejected' THEN 'Từ chối'
    ELSE p.account_status::text
  END AS account_status_display,
  
  -- Employment Status
  ep.employment_status,
  CASE ep.employment_status
    WHEN 'probation' THEN 'Thử việc'
    WHEN 'active' THEN 'Chính thức'
    WHEN 'on_leave' THEN 'Nghỉ phép'
    WHEN 'terminated' THEN 'Đã nghỉ việc'
    ELSE ep.employment_status::text
  END AS employment_status_display,
  
  ep.joined_date,
  ep.left_date,
  p.created_at,
  p.updated_at
FROM public.profiles p
LEFT JOIN public.employee_profiles ep ON ep.user_id = p.id
LEFT JOIN public.departments d ON d.id = ep.department_id
LEFT JOIN public.teams t ON t.id = ep.team_id
LEFT JOIN public.profiles rp ON rp.id = ep.reports_to_user_id
LEFT JOIN public.employee_profiles rep ON rep.user_id = ep.reports_to_user_id;

COMMENT ON VIEW public.admin_people IS 'Readable view for internal personnel and employees with TK_ and NV_ business codes.';

-- 4. View: Departments (admin_departments)
CREATE OR REPLACE VIEW public.admin_departments
WITH (security_invoker = true)
AS
SELECT
  d.id AS department_id,
  d.department_code,
  d.name AS department_name,
  d.description,
  d.is_active,
  CASE WHEN d.is_active THEN 'Hoạt động' ELSE 'Tạm dừng' END AS status_display,
  
  -- Aggregate team & employee counts
  COALESCE(t_count.total, 0) AS team_count,
  COALESCE(e_count.total, 0) AS employee_count,
  
  d.created_at,
  d.updated_at
FROM public.departments d
LEFT JOIN (
  SELECT department_id, COUNT(*) AS total
  FROM public.teams
  GROUP BY department_id
) t_count ON t_count.department_id = d.id
LEFT JOIN (
  SELECT department_id, COUNT(*) AS total
  FROM public.employee_profiles
  WHERE department_id IS NOT NULL
  GROUP BY department_id
) e_count ON e_count.department_id = d.id;

COMMENT ON VIEW public.admin_departments IS 'Readable view for agency departments with PB_ codes and aggregate stats.';

-- 5. View: Teams (admin_teams)
CREATE OR REPLACE VIEW public.admin_teams
WITH (security_invoker = true)
AS
SELECT
  t.id AS team_id,
  t.team_code,
  t.name AS team_name,
  
  -- Department info
  d.id AS department_id,
  d.department_code,
  d.name AS department_name,
  
  -- Leader info
  t.leader_user_id AS leader_id,
  lep.employee_code AS leader_code,
  lp.full_name AS leader_name,
  
  -- Member count
  COALESCE(m_count.total, 0) AS member_count,
  
  t.description,
  t.is_active,
  CASE WHEN t.is_active THEN 'Hoạt động' ELSE 'Tạm dừng' END AS status_display,
  t.created_at,
  t.updated_at
FROM public.teams t
LEFT JOIN public.departments d ON d.id = t.department_id
LEFT JOIN public.profiles lp ON lp.id = t.leader_user_id
LEFT JOIN public.employee_profiles lep ON lep.user_id = t.leader_user_id
LEFT JOIN (
  SELECT team_id, COUNT(*) AS total
  FROM public.employee_profiles
  WHERE team_id IS NOT NULL
  GROUP BY team_id
) m_count ON m_count.team_id = t.id;

COMMENT ON VIEW public.admin_teams IS 'Readable view for agency teams with N_ codes and leader resolution.';

-- 6. View: Projects (admin_projects)
CREATE OR REPLACE VIEW public.admin_projects
WITH (security_invoker = true)
AS
SELECT
  p.id AS project_id,
  p.project_code,
  p.name AS project_name,
  
  -- Client info
  c.id AS client_id,
  c.client_code,
  c.name AS client_name,
  
  -- Project Manager info
  p.project_manager_user_id AS project_manager_id,
  mep.employee_code AS project_manager_code,
  mp.full_name AS project_manager_name,
  
  -- Status & Display
  p.status,
  CASE p.status
    WHEN 'draft' THEN 'Bản thảo'
    WHEN 'active' THEN 'Đang thực hiện'
    WHEN 'on_hold' THEN 'Tạm dừng'
    WHEN 'completed' THEN 'Hoàn thành'
    WHEN 'cancelled' THEN 'Hủy bỏ'
    ELSE p.status::text
  END AS status_display,
  
  -- Priority & Display
  p.priority,
  CASE p.priority
    WHEN 'low' THEN 'Thấp'
    WHEN 'medium' THEN 'Trung bình'
    WHEN 'high' THEN 'Cao'
    WHEN 'urgent' THEN 'Khẩn cấp'
    ELSE p.priority::text
  END AS priority_display,
  
  p.start_date,
  p.due_date,
  p.completed_at,
  p.description,
  p.created_at,
  p.updated_at
FROM public.projects p
LEFT JOIN public.client_companies c ON c.id = p.client_company_id
LEFT JOIN public.profiles mp ON mp.id = p.project_manager_user_id
LEFT JOIN public.employee_profiles mep ON mep.user_id = p.project_manager_user_id;

COMMENT ON VIEW public.admin_projects IS 'Readable view for projects with DA_ and KH_ business codes.';

-- 7. View: Tasks (admin_tasks)
CREATE OR REPLACE VIEW public.admin_tasks
WITH (security_invoker = true)
AS
SELECT
  t.id AS task_id,
  t.task_code,
  t.title AS task_title,
  
  -- Project info
  p.id AS project_id,
  p.project_code,
  p.name AS project_name,
  
  -- Assignee info
  t.assignee_user_id AS assignee_id,
  aep.employee_code AS assignee_code,
  ap.full_name AS assignee_name,
  
  -- Reporter info
  t.reporter_user_id AS reporter_id,
  rep.employee_code AS reporter_code,
  rp.full_name AS reporter_name,
  
  -- Status & Display
  t.status,
  CASE t.status
    WHEN 'todo' THEN 'Cần làm'
    WHEN 'in_progress' THEN 'Đang làm'
    WHEN 'review' THEN 'Chờ duyệt'
    WHEN 'done' THEN 'Hoàn thành'
    WHEN 'cancelled' THEN 'Hủy bỏ'
    ELSE t.status::text
  END AS status_display,
  
  -- Priority & Display
  t.priority,
  CASE t.priority
    WHEN 'low' THEN 'Thấp'
    WHEN 'medium' THEN 'Trung bình'
    WHEN 'high' THEN 'Cao'
    WHEN 'urgent' THEN 'Khẩn cấp'
    ELSE t.priority::text
  END AS priority_display,
  
  t.start_date,
  t.due_date,
  t.completed_at,
  t.description,
  t.sort_order,
  t.created_at,
  t.updated_at
FROM public.tasks t
LEFT JOIN public.projects p ON p.id = t.project_id
LEFT JOIN public.profiles ap ON ap.id = t.assignee_user_id
LEFT JOIN public.employee_profiles aep ON aep.user_id = t.assignee_user_id
LEFT JOIN public.profiles rp ON rp.id = t.reporter_user_id
LEFT JOIN public.employee_profiles rep ON rep.user_id = t.reporter_user_id;

COMMENT ON VIEW public.admin_tasks IS 'Readable view for project tasks with CV_, DA_, and NV_ business codes.';

-- 8. View: Attendance Records (admin_attendance_records)
CREATE OR REPLACE VIEW public.admin_attendance_records
WITH (security_invoker = true)
AS
SELECT
  ar.id AS attendance_id,
  ar.attendance_code,
  
  -- Employee info
  ar.user_id AS employee_id,
  ep.employee_code,
  p.full_name AS employee_name,
  
  ar.attendance_date AS work_date,
  ar.check_in_at,
  ar.check_out_at,
  
  -- Status & Display
  ar.status,
  CASE ar.status
    WHEN 'present' THEN 'Có mặt'
    WHEN 'late' THEN 'Đi muộn'
    WHEN 'early_leave' THEN 'Về sớm'
    WHEN 'late_and_early_leave' THEN 'Đi muộn & Về sớm'
    WHEN 'incomplete' THEN 'Chưa hoàn tất'
    WHEN 'absent' THEN 'Vắng mặt'
    WHEN 'on_leave' THEN 'Nghỉ phép'
    ELSE ar.status::text
  END AS status_display,
  
  ar.late_minutes,
  ar.early_leave_minutes,
  ar.work_minutes,
  ar.check_in_note,
  ar.check_out_note,
  ar.source,
  ar.created_at,
  ar.updated_at
FROM public.attendance_records ar
LEFT JOIN public.profiles p ON p.id = ar.user_id
LEFT JOIN public.employee_profiles ep ON ep.user_id = ar.user_id;

COMMENT ON VIEW public.admin_attendance_records IS 'Readable view for daily attendance records with CC_ and NV_ business codes.';

-- 9. View: Leave Requests (admin_leave_requests)
CREATE OR REPLACE VIEW public.admin_leave_requests
WITH (security_invoker = true)
AS
SELECT
  lr.id AS leave_request_id,
  lr.leave_code,
  
  -- Employee info
  lr.user_id AS employee_id,
  ep.employee_code,
  p.full_name AS employee_name,
  
  -- Leave Type
  lt.id AS leave_type_id,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  
  lr.start_date,
  lr.end_date,
  lr.total_days,
  lr.reason,
  
  -- Status & Display
  lr.status,
  CASE lr.status
    WHEN 'pending' THEN 'Chờ duyệt'
    WHEN 'approved' THEN 'Đã duyệt'
    WHEN 'rejected' THEN 'Từ chối'
    WHEN 'cancelled' THEN 'Đã hủy'
    ELSE lr.status::text
  END AS status_display,
  
  -- Reviewer info
  lr.reviewer_user_id AS reviewer_id,
  rep.employee_code AS reviewer_code,
  rp.full_name AS reviewer_name,
  lr.review_note,
  lr.reviewed_at,
  
  lr.created_at,
  lr.updated_at
FROM public.leave_requests lr
LEFT JOIN public.profiles p ON p.id = lr.user_id
LEFT JOIN public.employee_profiles ep ON ep.user_id = lr.user_id
LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
LEFT JOIN public.profiles rp ON rp.id = lr.reviewer_user_id
LEFT JOIN public.employee_profiles rep ON rep.user_id = lr.reviewer_user_id;

COMMENT ON VIEW public.admin_leave_requests IS 'Readable view for employee leave requests with NP_ and NV_ business codes.';

-- 10. View: Contracts (admin_contracts)
CREATE OR REPLACE VIEW public.admin_contracts
WITH (security_invoker = true)
AS
SELECT
  ct.id AS contract_id,
  ct.contract_code,
  ct.contract_number,
  ct.title AS contract_title,
  
  -- Client info
  c.id AS client_id,
  c.client_code,
  c.name AS client_name,
  
  -- Project info
  p.id AS project_id,
  p.project_code,
  p.name AS project_name,
  
  ct.contract_value,
  ct.currency_code,
  
  -- Status & Display
  ct.status,
  CASE ct.status
    WHEN 'draft' THEN 'Bản thảo'
    WHEN 'active' THEN 'Đang hiệu lực'
    WHEN 'completed' THEN 'Hoàn tất'
    WHEN 'cancelled' THEN 'Đã hủy'
    ELSE ct.status::text
  END AS status_display,
  
  ct.start_date,
  ct.end_date,
  ct.completed_at,
  ct.client_visible,
  ct.created_at,
  ct.updated_at
FROM public.contracts ct
LEFT JOIN public.client_companies c ON c.id = ct.client_company_id
LEFT JOIN public.projects p ON p.id = ct.project_id;

COMMENT ON VIEW public.admin_contracts IS 'Readable view for finance contracts with HD_, KH_, and DA_ business codes.';

-- 11. View: Invoices (admin_invoices)
CREATE OR REPLACE VIEW public.admin_invoices
WITH (security_invoker = true)
AS
SELECT
  i.id AS invoice_id,
  i.invoice_code,
  i.invoice_number,
  
  -- Contract info
  ct.id AS contract_id,
  ct.contract_code,
  ct.contract_number,
  
  -- Client info
  c.id AS client_id,
  c.client_code,
  c.name AS client_name,
  
  -- Project info
  p.id AS project_id,
  p.project_code,
  p.name AS project_name,
  
  i.amount,
  i.paid_amount,
  (i.amount - i.paid_amount) AS outstanding_amount,
  i.currency_code,
  i.issue_date,
  i.due_date,
  i.paid_at,
  
  -- Status & Display
  i.status,
  CASE i.status
    WHEN 'draft' THEN 'Bản thảo'
    WHEN 'issued' THEN 'Đã phát hành'
    WHEN 'partially_paid' THEN 'Thanh toán một phần'
    WHEN 'paid' THEN 'Đã thanh toán'
    WHEN 'overdue' THEN 'Quá hạn'
    WHEN 'cancelled' THEN 'Đã hủy'
    ELSE i.status::text
  END AS status_display,
  
  i.client_visible,
  i.created_at,
  i.updated_at
FROM public.invoices i
LEFT JOIN public.contracts ct ON ct.id = i.contract_id
LEFT JOIN public.client_companies c ON c.id = i.client_company_id
LEFT JOIN public.projects p ON p.id = i.project_id;

COMMENT ON VIEW public.admin_invoices IS 'Readable view for invoices with HDON_, HD_, KH_, and DA_ business codes.';

-- 12. View: Payments (admin_payments)
CREATE OR REPLACE VIEW public.admin_payments
WITH (security_invoker = true)
AS
SELECT
  ip.id AS payment_id,
  ip.payment_code,
  
  -- Invoice info
  i.id AS invoice_id,
  i.invoice_code,
  i.invoice_number,
  
  -- Contract info
  ct.id AS contract_id,
  ct.contract_code,
  
  -- Client info
  c.id AS client_id,
  c.client_code,
  c.name AS client_name,
  
  ip.amount,
  ip.paid_at,
  ip.payment_reference,
  ip.payment_method,
  
  -- Recorded By info
  ip.recorded_by AS recorded_by_id,
  rep.employee_code AS recorded_by_code,
  rp.full_name AS recorded_by_name,
  
  ip.notes,
  ip.created_at
FROM public.invoice_payments ip
LEFT JOIN public.invoices i ON i.id = ip.invoice_id
LEFT JOIN public.contracts ct ON ct.id = i.contract_id
LEFT JOIN public.client_companies c ON c.id = i.client_company_id
LEFT JOIN public.profiles rp ON rp.id = ip.recorded_by
LEFT JOIN public.employee_profiles rep ON rep.user_id = ip.recorded_by;

COMMENT ON VIEW public.admin_payments IS 'Readable view for invoice payments with TT_, HDON_, and KH_ business codes.';

-- 13. View: Services (admin_services)
CREATE OR REPLACE VIEW public.admin_services
WITH (security_invoker = true)
AS
SELECT
  s.id AS service_id,
  s.service_code,
  s.code AS original_code,
  s.name AS service_name,
  s.description,
  s.active AS is_active,
  CASE WHEN s.active THEN 'Đang cung cấp' ELSE 'Tạm dừng' END AS status_display,
  s.created_at,
  s.updated_at
FROM public.services s;

COMMENT ON VIEW public.admin_services IS 'Readable view for service catalog with DV_ business codes.';

-- 14. Permissions: Grant SELECT on views to authenticated and service_role
GRANT SELECT ON public.admin_account_approval_events TO authenticated, service_role;
GRANT SELECT ON public.admin_clients TO authenticated, service_role;
GRANT SELECT ON public.admin_people TO authenticated, service_role;
GRANT SELECT ON public.admin_departments TO authenticated, service_role;
GRANT SELECT ON public.admin_teams TO authenticated, service_role;
GRANT SELECT ON public.admin_projects TO authenticated, service_role;
GRANT SELECT ON public.admin_tasks TO authenticated, service_role;
GRANT SELECT ON public.admin_attendance_records TO authenticated, service_role;
GRANT SELECT ON public.admin_leave_requests TO authenticated, service_role;
GRANT SELECT ON public.admin_contracts TO authenticated, service_role;
GRANT SELECT ON public.admin_invoices TO authenticated, service_role;
GRANT SELECT ON public.admin_payments TO authenticated, service_role;
GRANT SELECT ON public.admin_services TO authenticated, service_role;

REVOKE ALL ON public.admin_account_approval_events FROM anon, PUBLIC;
REVOKE ALL ON public.admin_clients FROM anon, PUBLIC;
REVOKE ALL ON public.admin_people FROM anon, PUBLIC;
REVOKE ALL ON public.admin_departments FROM anon, PUBLIC;
REVOKE ALL ON public.admin_teams FROM anon, PUBLIC;
REVOKE ALL ON public.admin_projects FROM anon, PUBLIC;
REVOKE ALL ON public.admin_tasks FROM anon, PUBLIC;
REVOKE ALL ON public.admin_attendance_records FROM anon, PUBLIC;
REVOKE ALL ON public.admin_leave_requests FROM anon, PUBLIC;
REVOKE ALL ON public.admin_contracts FROM anon, PUBLIC;
REVOKE ALL ON public.admin_invoices FROM anon, PUBLIC;
REVOKE ALL ON public.admin_payments FROM anon, PUBLIC;
REVOKE ALL ON public.admin_services FROM anon, PUBLIC;
