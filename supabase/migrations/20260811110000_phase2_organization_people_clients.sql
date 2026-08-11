-- A. Create Enums
CREATE TYPE public.employment_status AS ENUM ('probation', 'active', 'on_leave', 'terminated');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive');

-- B. Create Departments Table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_department_code_length CHECK (length(code) >= 2 AND length(code) <= 30),
  CONSTRAINT check_department_name_length CHECK (length(name) >= 2 AND length(name) <= 120)
);

-- C. Create Teams Table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  leader_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, code),
  CONSTRAINT check_team_code_length CHECK (length(code) >= 2 AND length(code) <= 30),
  CONSTRAINT check_team_name_length CHECK (length(name) >= 2 AND length(name) <= 120)
);

-- D. Create Employee Profiles Table
CREATE TABLE public.employee_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  job_title TEXT,
  reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  joined_date DATE,
  left_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_employee_code_length CHECK (length(employee_code) >= 2 AND length(employee_code) <= 30),
  CONSTRAINT check_reports_to_no_self CHECK (reports_to_user_id <> user_id)
);

-- E. Create Client Companies Table
CREATE TABLE public.client_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_code TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  status public.client_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_client_company_code_length CHECK (length(code) >= 2 AND length(code) <= 30)
);

-- F. Create Client Memberships Table
CREATE TABLE public.client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_company_id, user_id)
);

-- G. Create Constraints / Triggers for roles security
-- 1. leader_user_id must have active profile role = 'team_leader'
CREATE OR REPLACE FUNCTION public.check_team_leader_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
  v_status public.account_status;
BEGIN
  IF NEW.leader_user_id IS NOT NULL THEN
    SELECT role, account_status INTO v_role, v_status FROM public.profiles WHERE id = NEW.leader_user_id;
    IF v_role IS DISTINCT FROM 'team_leader' OR v_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Leader must be an active team_leader' USING ERRCODE = 'P0011';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_team_leader
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_team_leader_role();

-- 2. Employee profile user must have role admin/team_leader/employee/accountant
CREATE OR REPLACE FUNCTION public.check_employee_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role IS NULL OR v_role = 'client' THEN
    RAISE EXCEPTION 'Clients cannot have employee profiles' USING ERRCODE = 'P0012';
  END IF;

  -- Validate team belongs to department
  IF NEW.team_id IS NOT NULL THEN
    DECLARE
      v_team_dept_id UUID;
    BEGIN
      SELECT department_id INTO v_team_dept_id FROM public.teams WHERE id = NEW.team_id;
      IF NEW.department_id IS DISTINCT FROM v_team_dept_id THEN
        RAISE EXCEPTION 'Team must belong to the selected department' USING ERRCODE = 'P0013';
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_employee_profile
  BEFORE INSERT OR UPDATE ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_employee_profile_role();

-- 3. Client membership user must have role = 'client'
CREATE OR REPLACE FUNCTION public.check_client_membership_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only users with client role can be client members' USING ERRCODE = 'P0014';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_client_membership
  BEFORE INSERT OR UPDATE ON public.client_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_client_membership_role();

-- 4. Constraint at most one primary client company membership per user
CREATE UNIQUE INDEX client_memberships_one_primary_idx
  ON public.client_memberships (user_id)
  WHERE (is_primary = true);

-- H. Create Indexes
CREATE INDEX IF NOT EXISTS depts_code_idx ON public.departments (code);
CREATE INDEX IF NOT EXISTS depts_active_idx ON public.departments (is_active);

CREATE INDEX IF NOT EXISTS teams_dept_idx ON public.teams (department_id);
CREATE INDEX IF NOT EXISTS teams_leader_idx ON public.teams (leader_user_id);
CREATE INDEX IF NOT EXISTS teams_active_idx ON public.teams (is_active);

CREATE INDEX IF NOT EXISTS emp_dept_idx ON public.employee_profiles (department_id);
CREATE INDEX IF NOT EXISTS emp_team_idx ON public.employee_profiles (team_id);
CREATE INDEX IF NOT EXISTS emp_reports_idx ON public.employee_profiles (reports_to_user_id);
CREATE INDEX IF NOT EXISTS emp_status_idx ON public.employee_profiles (employment_status);
CREATE INDEX IF NOT EXISTS emp_code_idx ON public.employee_profiles (employee_code);

CREATE INDEX IF NOT EXISTS client_comp_code_idx ON public.client_companies (code);
CREATE INDEX IF NOT EXISTS client_comp_status_idx ON public.client_companies (status);
CREATE INDEX IF NOT EXISTS client_comp_name_idx ON public.client_companies (name);

CREATE INDEX IF NOT EXISTS client_mem_user_idx ON public.client_memberships (user_id);
CREATE INDEX IF NOT EXISTS client_mem_comp_idx ON public.client_memberships (client_company_id);

-- I. Reusable updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_updated_at_departments BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_teams BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_employee_profiles BEFORE UPDATE ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trigger_set_updated_at_client_companies BEFORE UPDATE ON public.client_companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- J. Enable Row Level Security (RLS)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memberships ENABLE ROW LEVEL SECURITY;

-- Note: NestJS utilizes service_role which bypasses RLS rules, no authenticated RLS CRUD policy defined for browsers.
