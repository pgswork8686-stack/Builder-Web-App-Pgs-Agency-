-- ==========================================================================
-- Phase 8: Foreign key index hardening
-- --------------------------------------------------------------------------
-- Add covering indexes for historical FK columns reported by Supabase
-- performance advisor. These are additive and safe for existing data.
-- ==========================================================================

CREATE INDEX IF NOT EXISTS client_companies_created_by_idx
  ON public.client_companies (created_by);
CREATE INDEX IF NOT EXISTS client_companies_updated_by_idx
  ON public.client_companies (updated_by);

CREATE INDEX IF NOT EXISTS client_memberships_created_by_idx
  ON public.client_memberships (created_by);

CREATE INDEX IF NOT EXISTS departments_created_by_idx
  ON public.departments (created_by);
CREATE INDEX IF NOT EXISTS departments_updated_by_idx
  ON public.departments (updated_by);

CREATE INDEX IF NOT EXISTS employee_profiles_created_by_idx
  ON public.employee_profiles (created_by);
CREATE INDEX IF NOT EXISTS employee_profiles_updated_by_idx
  ON public.employee_profiles (updated_by);

CREATE INDEX IF NOT EXISTS profiles_approved_by_idx
  ON public.profiles (approved_by);
CREATE INDEX IF NOT EXISTS profiles_rejected_by_idx
  ON public.profiles (rejected_by);

CREATE INDEX IF NOT EXISTS project_memberships_created_by_idx
  ON public.project_memberships (created_by);

CREATE INDEX IF NOT EXISTS project_services_created_by_idx
  ON public.project_services (created_by);
CREATE INDEX IF NOT EXISTS project_services_updated_by_idx
  ON public.project_services (updated_by);

CREATE INDEX IF NOT EXISTS projects_created_by_idx
  ON public.projects (created_by);
CREATE INDEX IF NOT EXISTS projects_updated_by_idx
  ON public.projects (updated_by);

CREATE INDEX IF NOT EXISTS services_created_by_idx
  ON public.services (created_by);
CREATE INDEX IF NOT EXISTS services_updated_by_idx
  ON public.services (updated_by);

CREATE INDEX IF NOT EXISTS tasks_created_by_idx
  ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS tasks_reporter_user_id_idx
  ON public.tasks (reporter_user_id);
CREATE INDEX IF NOT EXISTS tasks_updated_by_idx
  ON public.tasks (updated_by);

CREATE INDEX IF NOT EXISTS teams_created_by_idx
  ON public.teams (created_by);
CREATE INDEX IF NOT EXISTS teams_updated_by_idx
  ON public.teams (updated_by);
