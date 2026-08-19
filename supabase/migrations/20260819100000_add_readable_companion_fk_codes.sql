-- ============================================================
-- Migration: Add Companion Readable Business Codes to Core Tables
-- Timestamp: 20260819100000_add_readable_companion_fk_codes.sql
-- Description:
--   1. Adds readable companion business code columns alongside UUID foreign keys
--      across all core business tables so original tables are human-readable
--      directly in Supabase Table Editor.
--   2. Reusable triggers ensure companion codes are always derived from UUID source of truth,
--      auto-synced on insert/update, overridden if client sends wrong code,
--      and set to NULL if UUID is NULL.
--   3. All functions specify `SET search_path = ''` and schema-qualify pg_catalog/public.
--   4. Performs non-destructive deterministic backfill for all existing rows.
--   5. Creates selective indexes on frequently queried companion codes.
-- ============================================================

-- ============================================================
-- 1. ADD COMPANION BUSINESS CODE COLUMNS TO CORE TABLES
-- ============================================================

-- A. account_approval_events
ALTER TABLE public.account_approval_events
  ADD COLUMN IF NOT EXISTS target_user_code TEXT,
  ADD COLUMN IF NOT EXISTS actor_user_code TEXT;

-- B. employee_profiles
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS account_code TEXT,
  ADD COLUMN IF NOT EXISTS department_code TEXT,
  ADD COLUMN IF NOT EXISTS team_code TEXT,
  ADD COLUMN IF NOT EXISTS reports_to_user_code TEXT;

-- C. client_memberships
ALTER TABLE public.client_memberships
  ADD COLUMN IF NOT EXISTS client_code TEXT,
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT;

-- D. projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_code TEXT,
  ADD COLUMN IF NOT EXISTS project_manager_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- E. project_memberships
ALTER TABLE public.project_memberships
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT;

-- F. project_services
ALTER TABLE public.project_services
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS service_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- G. tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS assignee_user_code TEXT,
  ADD COLUMN IF NOT EXISTS reporter_user_code TEXT,
  ADD COLUMN IF NOT EXISTS parent_task_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- H. task_comments
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS task_code TEXT,
  ADD COLUMN IF NOT EXISTS author_user_code TEXT;

-- I. project_files
ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS task_code TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_code TEXT;

-- J. file_upload_sessions
ALTER TABLE public.file_upload_sessions
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS task_code TEXT,
  ADD COLUMN IF NOT EXISTS user_code TEXT;

-- K. contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_code TEXT,
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- L. invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contract_code TEXT,
  ADD COLUMN IF NOT EXISTS client_code TEXT,
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- M. invoice_payments
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS invoice_code TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by_code TEXT;

-- N. finance_audit_events
ALTER TABLE public.finance_audit_events
  ADD COLUMN IF NOT EXISTS actor_user_code TEXT;

-- O. attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS employee_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- P. attendance_adjustments
ALTER TABLE public.attendance_adjustments
  ADD COLUMN IF NOT EXISTS attendance_code TEXT,
  ADD COLUMN IF NOT EXISTS requested_by_code TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_code TEXT;

-- Q. attendance_photo_upload_sessions
ALTER TABLE public.attendance_photo_upload_sessions
  ADD COLUMN IF NOT EXISTS user_code TEXT;

-- R. leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_user_code TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by_code TEXT;

-- S. leave_balances
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS user_code TEXT;

-- T. leave_balance_adjustments
ALTER TABLE public.leave_balance_adjustments
  ADD COLUMN IF NOT EXISTS actor_user_code TEXT;

-- U. notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT;

-- V. notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS user_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- W. chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS direct_user_low_code TEXT,
  ADD COLUMN IF NOT EXISTS direct_user_high_code TEXT,
  ADD COLUMN IF NOT EXISTS project_code TEXT;

-- X. chat_members
ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS user_code TEXT;

-- Y. chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_user_code TEXT;

-- Z. automation_rules
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- AA. services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- AB. teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS department_code TEXT,
  ADD COLUMN IF NOT EXISTS leader_user_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;


-- ============================================================
-- 2. TRIGGER FUNCTIONS FOR AUTOMATED COMPANION CODE SYNC
-- ============================================================

-- A. account_approval_events
CREATE OR REPLACE FUNCTION public.sync_companion_codes_account_approval_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.target_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.target_user);
  NEW.actor_user_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.actor);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_account_approval_events ON public.account_approval_events;
CREATE TRIGGER trg_sync_companion_codes_account_approval_events
  BEFORE INSERT OR UPDATE ON public.account_approval_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_account_approval_events();


-- B. employee_profiles
CREATE OR REPLACE FUNCTION public.sync_companion_codes_employee_profiles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.account_code         := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.department_code      := (SELECT department_code FROM public.departments WHERE id = NEW.department_id);
  NEW.team_code            := (SELECT team_code FROM public.teams WHERE id = NEW.team_id);
  NEW.reports_to_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.reports_to_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_employee_profiles ON public.employee_profiles;
CREATE TRIGGER trg_sync_companion_codes_employee_profiles
  BEFORE INSERT OR UPDATE ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_employee_profiles();


-- C. client_memberships
CREATE OR REPLACE FUNCTION public.sync_companion_codes_client_memberships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.client_code     := (SELECT client_code FROM public.client_companies WHERE id = NEW.client_company_id);
  NEW.user_code       := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_client_memberships ON public.client_memberships;
CREATE TRIGGER trg_sync_companion_codes_client_memberships
  BEFORE INSERT OR UPDATE ON public.client_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_client_memberships();


-- D. projects
CREATE OR REPLACE FUNCTION public.sync_companion_codes_projects()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.client_code          := (SELECT client_code FROM public.client_companies WHERE id = NEW.client_company_id);
  NEW.project_manager_code := (SELECT account_code FROM public.profiles WHERE id = NEW.project_manager_user_id);
  NEW.created_by_code      := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code      := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_projects ON public.projects;
CREATE TRIGGER trg_sync_companion_codes_projects
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_projects();


-- E. project_memberships
CREATE OR REPLACE FUNCTION public.sync_companion_codes_project_memberships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.project_code    := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.user_code       := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_project_memberships ON public.project_memberships;
CREATE TRIGGER trg_sync_companion_codes_project_memberships
  BEFORE INSERT OR UPDATE ON public.project_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_project_memberships();


-- F. project_services
CREATE OR REPLACE FUNCTION public.sync_companion_codes_project_services()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.project_code    := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.service_code    := (SELECT service_code FROM public.services WHERE id = NEW.service_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_project_services ON public.project_services;
CREATE TRIGGER trg_sync_companion_codes_project_services
  BEFORE INSERT OR UPDATE ON public.project_services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_project_services();


-- G. tasks
CREATE OR REPLACE FUNCTION public.sync_companion_codes_tasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.project_code        := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.assignee_user_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.assignee_user_id);
  NEW.reporter_user_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.reporter_user_id);
  NEW.parent_task_code    := (SELECT task_code FROM public.tasks WHERE id = NEW.parent_task_id);
  NEW.created_by_code     := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code     := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_tasks ON public.tasks;
CREATE TRIGGER trg_sync_companion_codes_tasks
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_tasks();


-- H. task_comments
CREATE OR REPLACE FUNCTION public.sync_companion_codes_task_comments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.task_code        := (SELECT task_code FROM public.tasks WHERE id = NEW.task_id);
  NEW.author_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.author_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_task_comments ON public.task_comments;
CREATE TRIGGER trg_sync_companion_codes_task_comments
  BEFORE INSERT OR UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_task_comments();


-- I. project_files
CREATE OR REPLACE FUNCTION public.sync_companion_codes_project_files()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.project_code     := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.task_code        := (SELECT task_code FROM public.tasks WHERE id = NEW.task_id);
  NEW.uploaded_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.uploaded_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_project_files ON public.project_files;
CREATE TRIGGER trg_sync_companion_codes_project_files
  BEFORE INSERT OR UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_project_files();


-- J. file_upload_sessions
CREATE OR REPLACE FUNCTION public.sync_companion_codes_file_upload_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.project_code := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.task_code    := (SELECT task_code FROM public.tasks WHERE id = NEW.task_id);
  NEW.user_code    := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_file_upload_sessions ON public.file_upload_sessions;
CREATE TRIGGER trg_sync_companion_codes_file_upload_sessions
  BEFORE INSERT OR UPDATE ON public.file_upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_file_upload_sessions();


-- K. contracts
CREATE OR REPLACE FUNCTION public.sync_companion_codes_contracts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.client_code     := (SELECT client_code FROM public.client_companies WHERE id = NEW.client_company_id);
  NEW.project_code    := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_contracts ON public.contracts;
CREATE TRIGGER trg_sync_companion_codes_contracts
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_contracts();


-- L. invoices
CREATE OR REPLACE FUNCTION public.sync_companion_codes_invoices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.contract_code   := (SELECT contract_code FROM public.contracts WHERE id = NEW.contract_id);
  NEW.client_code     := (SELECT client_code FROM public.client_companies WHERE id = NEW.client_company_id);
  NEW.project_code    := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_invoices ON public.invoices;
CREATE TRIGGER trg_sync_companion_codes_invoices
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_invoices();


-- M. invoice_payments
CREATE OR REPLACE FUNCTION public.sync_companion_codes_invoice_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.invoice_code     := (SELECT invoice_code FROM public.invoices WHERE id = NEW.invoice_id);
  NEW.recorded_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.recorded_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_invoice_payments ON public.invoice_payments;
CREATE TRIGGER trg_sync_companion_codes_invoice_payments
  BEFORE INSERT OR UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_invoice_payments();


-- N. finance_audit_events
CREATE OR REPLACE FUNCTION public.sync_companion_codes_finance_audit_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.actor_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.actor_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_finance_audit_events ON public.finance_audit_events;
CREATE TRIGGER trg_sync_companion_codes_finance_audit_events
  BEFORE INSERT OR UPDATE ON public.finance_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_finance_audit_events();


-- O. attendance_records
CREATE OR REPLACE FUNCTION public.sync_companion_codes_attendance_records()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code        := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.employee_code    := (SELECT employee_code FROM public.employee_profiles WHERE user_id = NEW.user_id);
  NEW.created_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_attendance_records ON public.attendance_records;
CREATE TRIGGER trg_sync_companion_codes_attendance_records
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_attendance_records();


-- P. attendance_adjustments
CREATE OR REPLACE FUNCTION public.sync_companion_codes_attendance_adjustments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.attendance_code   := (SELECT attendance_code FROM public.attendance_records WHERE id = NEW.attendance_record_id);
  NEW.requested_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.requested_by);
  NEW.approved_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.approved_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_attendance_adjustments ON public.attendance_adjustments;
CREATE TRIGGER trg_sync_companion_codes_attendance_adjustments
  BEFORE INSERT OR UPDATE ON public.attendance_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_attendance_adjustments();


-- Q. attendance_photo_upload_sessions
CREATE OR REPLACE FUNCTION public.sync_companion_codes_attendance_photo_upload_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_attendance_photo_upload_sessions ON public.attendance_photo_upload_sessions;
CREATE TRIGGER trg_sync_companion_codes_attendance_photo_upload_sessions
  BEFORE INSERT OR UPDATE ON public.attendance_photo_upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_attendance_photo_upload_sessions();


-- R. leave_requests
CREATE OR REPLACE FUNCTION public.sync_companion_codes_leave_requests()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code          := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.reviewer_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.reviewer_user_id);
  NEW.cancelled_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.cancelled_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_sync_companion_codes_leave_requests
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_leave_requests();


-- S. leave_balances
CREATE OR REPLACE FUNCTION public.sync_companion_codes_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_leave_balances ON public.leave_balances;
CREATE TRIGGER trg_sync_companion_codes_leave_balances
  BEFORE INSERT OR UPDATE ON public.leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_leave_balances();


-- T. leave_balance_adjustments
CREATE OR REPLACE FUNCTION public.sync_companion_codes_leave_balance_adjustments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.actor_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.actor_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_leave_balance_adjustments ON public.leave_balance_adjustments;
CREATE TRIGGER trg_sync_companion_codes_leave_balance_adjustments
  BEFORE INSERT OR UPDATE ON public.leave_balance_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_leave_balance_adjustments();


-- U. notifications
CREATE OR REPLACE FUNCTION public.sync_companion_codes_notifications()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.recipient_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.recipient_user_id);
  NEW.created_by_code      := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_notifications ON public.notifications;
CREATE TRIGGER trg_sync_companion_codes_notifications
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_notifications();


-- V. notification_preferences
CREATE OR REPLACE FUNCTION public.sync_companion_codes_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code       := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_notification_preferences ON public.notification_preferences;
CREATE TRIGGER trg_sync_companion_codes_notification_preferences
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_notification_preferences();


-- W. chat_conversations
CREATE OR REPLACE FUNCTION public.sync_companion_codes_chat_conversations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_by_code       := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.direct_user_low_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.direct_user_low);
  NEW.direct_user_high_code := (SELECT account_code FROM public.profiles WHERE id = NEW.direct_user_high);
  NEW.project_code          := (SELECT project_code FROM public.projects WHERE id = NEW.project_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_chat_conversations ON public.chat_conversations;
CREATE TRIGGER trg_sync_companion_codes_chat_conversations
  BEFORE INSERT OR UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_chat_conversations();


-- X. chat_members
CREATE OR REPLACE FUNCTION public.sync_companion_codes_chat_members()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_chat_members ON public.chat_members;
CREATE TRIGGER trg_sync_companion_codes_chat_members
  BEFORE INSERT OR UPDATE ON public.chat_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_chat_members();


-- Y. chat_messages
CREATE OR REPLACE FUNCTION public.sync_companion_codes_chat_messages()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.sender_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.sender_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_chat_messages ON public.chat_messages;
CREATE TRIGGER trg_sync_companion_codes_chat_messages
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_chat_messages();


-- Z. automation_rules
CREATE OR REPLACE FUNCTION public.sync_companion_codes_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_automation_rules ON public.automation_rules;
CREATE TRIGGER trg_sync_companion_codes_automation_rules
  BEFORE INSERT OR UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_automation_rules();


-- AA. services
CREATE OR REPLACE FUNCTION public.sync_companion_codes_services()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_services ON public.services;
CREATE TRIGGER trg_sync_companion_codes_services
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_services();


-- AB. teams
CREATE OR REPLACE FUNCTION public.sync_companion_codes_teams()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.department_code  := (SELECT department_code FROM public.departments WHERE id = NEW.department_id);
  NEW.leader_user_code := (SELECT account_code FROM public.profiles WHERE id = NEW.leader_user_id);
  NEW.created_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.created_by);
  NEW.updated_by_code  := (SELECT account_code FROM public.profiles WHERE id = NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_companion_codes_teams ON public.teams;
CREATE TRIGGER trg_sync_companion_codes_teams
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_companion_codes_teams();


-- ============================================================
-- 3. DETERMINISTIC NON-DESTRUCTIVE BACKFILL FOR EXISTING ROWS
-- ============================================================

-- A. account_approval_events
UPDATE public.account_approval_events aae
SET
  target_user_code = (SELECT account_code FROM public.profiles WHERE id = aae.target_user),
  actor_user_code  = (SELECT account_code FROM public.profiles WHERE id = aae.actor);

-- B. employee_profiles
UPDATE public.employee_profiles ep
SET
  account_code         = (SELECT account_code FROM public.profiles WHERE id = ep.user_id),
  department_code      = (SELECT department_code FROM public.departments WHERE id = ep.department_id),
  team_code            = (SELECT team_code FROM public.teams WHERE id = ep.team_id),
  reports_to_user_code = (SELECT account_code FROM public.profiles WHERE id = ep.reports_to_user_id);

-- C. client_memberships
UPDATE public.client_memberships cm
SET
  client_code     = (SELECT client_code FROM public.client_companies WHERE id = cm.client_company_id),
  user_code       = (SELECT account_code FROM public.profiles WHERE id = cm.user_id),
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = cm.created_by);

-- D. projects
UPDATE public.projects pr
SET
  client_code          = (SELECT client_code FROM public.client_companies WHERE id = pr.client_company_id),
  project_manager_code = (SELECT account_code FROM public.profiles WHERE id = pr.project_manager_user_id),
  created_by_code      = (SELECT account_code FROM public.profiles WHERE id = pr.created_by),
  updated_by_code      = (SELECT account_code FROM public.profiles WHERE id = pr.updated_by);

-- E. project_memberships
UPDATE public.project_memberships pm
SET
  project_code    = (SELECT project_code FROM public.projects WHERE id = pm.project_id),
  user_code       = (SELECT account_code FROM public.profiles WHERE id = pm.user_id),
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = pm.created_by);

-- F. project_services
UPDATE public.project_services ps
SET
  project_code    = (SELECT project_code FROM public.projects WHERE id = ps.project_id),
  service_code    = (SELECT service_code FROM public.services WHERE id = ps.service_id),
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = ps.created_by),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = ps.updated_by);

-- G. tasks
UPDATE public.tasks t
SET
  project_code        = (SELECT project_code FROM public.projects WHERE id = t.project_id),
  assignee_user_code  = (SELECT account_code FROM public.profiles WHERE id = t.assignee_user_id),
  reporter_user_code  = (SELECT account_code FROM public.profiles WHERE id = t.reporter_user_id),
  parent_task_code    = (SELECT task_code FROM public.tasks WHERE id = t.parent_task_id),
  created_by_code     = (SELECT account_code FROM public.profiles WHERE id = t.created_by),
  updated_by_code     = (SELECT account_code FROM public.profiles WHERE id = t.updated_by);

-- H. task_comments
UPDATE public.task_comments tc
SET
  task_code        = (SELECT task_code FROM public.tasks WHERE id = tc.task_id),
  author_user_code = (SELECT account_code FROM public.profiles WHERE id = tc.author_user_id);

-- I. project_files
UPDATE public.project_files pf
SET
  project_code     = (SELECT project_code FROM public.projects WHERE id = pf.project_id),
  task_code        = (SELECT task_code FROM public.tasks WHERE id = pf.task_id),
  uploaded_by_code = (SELECT account_code FROM public.profiles WHERE id = pf.uploaded_by);

-- J. file_upload_sessions
UPDATE public.file_upload_sessions fus
SET
  project_code = (SELECT project_code FROM public.projects WHERE id = fus.project_id),
  task_code    = (SELECT task_code FROM public.tasks WHERE id = fus.task_id),
  user_code    = (SELECT account_code FROM public.profiles WHERE id = fus.user_id);

-- K. contracts
UPDATE public.contracts ct
SET
  client_code     = (SELECT client_code FROM public.client_companies WHERE id = ct.client_company_id),
  project_code    = (SELECT project_code FROM public.projects WHERE id = ct.project_id),
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = ct.created_by),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = ct.updated_by);

-- L. invoices
UPDATE public.invoices inv
SET
  contract_code   = (SELECT contract_code FROM public.contracts WHERE id = inv.contract_id),
  client_code     = (SELECT client_code FROM public.client_companies WHERE id = inv.client_company_id),
  project_code    = (SELECT project_code FROM public.projects WHERE id = inv.project_id),
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = inv.created_by),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = inv.updated_by);

-- M. invoice_payments
UPDATE public.invoice_payments ip
SET
  invoice_code     = (SELECT invoice_code FROM public.invoices WHERE id = ip.invoice_id),
  recorded_by_code = (SELECT account_code FROM public.profiles WHERE id = ip.recorded_by);

-- N. finance_audit_events
UPDATE public.finance_audit_events fae
SET
  actor_user_code = (SELECT account_code FROM public.profiles WHERE id = fae.actor_user_id);

-- O. attendance_records
UPDATE public.attendance_records ar
SET
  user_code        = (SELECT account_code FROM public.profiles WHERE id = ar.user_id),
  employee_code    = (SELECT employee_code FROM public.employee_profiles WHERE user_id = ar.user_id),
  created_by_code  = (SELECT account_code FROM public.profiles WHERE id = ar.created_by),
  updated_by_code  = (SELECT account_code FROM public.profiles WHERE id = ar.updated_by);

-- P. attendance_adjustments
UPDATE public.attendance_adjustments aa
SET
  attendance_code   = (SELECT attendance_code FROM public.attendance_records WHERE id = aa.attendance_record_id),
  requested_by_code = (SELECT account_code FROM public.profiles WHERE id = aa.requested_by),
  approved_by_code  = (SELECT account_code FROM public.profiles WHERE id = aa.approved_by);

-- Q. attendance_photo_upload_sessions
UPDATE public.attendance_photo_upload_sessions apus
SET
  user_code = (SELECT account_code FROM public.profiles WHERE id = apus.user_id);

-- R. leave_requests
UPDATE public.leave_requests lr
SET
  user_code          = (SELECT account_code FROM public.profiles WHERE id = lr.user_id),
  reviewer_user_code = (SELECT account_code FROM public.profiles WHERE id = lr.reviewer_user_id),
  cancelled_by_code  = (SELECT account_code FROM public.profiles WHERE id = lr.cancelled_by);

-- S. leave_balances
UPDATE public.leave_balances lb
SET
  user_code = (SELECT account_code FROM public.profiles WHERE id = lb.user_id);

-- T. leave_balance_adjustments
UPDATE public.leave_balance_adjustments lba
SET
  actor_user_code = (SELECT account_code FROM public.profiles WHERE id = lba.actor_user_id);

-- U. notifications
UPDATE public.notifications n
SET
  recipient_user_code = (SELECT account_code FROM public.profiles WHERE id = n.recipient_user_id),
  created_by_code      = (SELECT account_code FROM public.profiles WHERE id = n.created_by);

-- V. notification_preferences
UPDATE public.notification_preferences np
SET
  user_code       = (SELECT account_code FROM public.profiles WHERE id = np.user_id),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = np.updated_by);

-- W. chat_conversations
UPDATE public.chat_conversations cc
SET
  created_by_code       = (SELECT account_code FROM public.profiles WHERE id = cc.created_by),
  direct_user_low_code  = (SELECT account_code FROM public.profiles WHERE id = cc.direct_user_low),
  direct_user_high_code = (SELECT account_code FROM public.profiles WHERE id = cc.direct_user_high),
  project_code          = (SELECT project_code FROM public.projects WHERE id = cc.project_id);

-- X. chat_members
UPDATE public.chat_members cm
SET
  user_code = (SELECT account_code FROM public.profiles WHERE id = cm.user_id);

-- Y. chat_messages
UPDATE public.chat_messages cm
SET
  sender_user_code = (SELECT account_code FROM public.profiles WHERE id = cm.sender_user_id);

-- Z. automation_rules
UPDATE public.automation_rules ar
SET
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = ar.created_by),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = ar.updated_by);

-- AA. services
UPDATE public.services s
SET
  created_by_code = (SELECT account_code FROM public.profiles WHERE id = s.created_by),
  updated_by_code = (SELECT account_code FROM public.profiles WHERE id = s.updated_by);

-- AB. teams
UPDATE public.teams t
SET
  department_code  = (SELECT department_code FROM public.departments WHERE id = t.department_id),
  leader_user_code = (SELECT account_code FROM public.profiles WHERE id = t.leader_user_id),
  created_by_code  = (SELECT account_code FROM public.profiles WHERE id = t.created_by),
  updated_by_code  = (SELECT account_code FROM public.profiles WHERE id = t.updated_by);


-- ============================================================
-- 4. SELECTIVE INDEXES FOR COMPANION CODES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_client_code ON public.projects(client_code) WHERE client_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_code ON public.tasks(project_code) WHERE project_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_user_code ON public.tasks(assignee_user_code) WHERE assignee_user_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_client_code ON public.contracts(client_code) WHERE client_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_client_code ON public.invoices(client_code) WHERE client_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_code ON public.invoice_payments(invoice_code) WHERE invoice_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_code ON public.attendance_records(user_code) WHERE user_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_code ON public.leave_requests(user_code) WHERE user_code IS NOT NULL;
