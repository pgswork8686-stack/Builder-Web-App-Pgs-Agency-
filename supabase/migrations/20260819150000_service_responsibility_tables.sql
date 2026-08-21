CREATE TABLE IF NOT EXISTS public.service_department_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_code TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  department_code TEXT,
  responsibility_role TEXT NOT NULL DEFAULT 'owner' CHECK (responsibility_role IN ('owner','collaborator')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_department_assignments_service_department_key UNIQUE(service_id, department_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_department_single_owner
  ON public.service_department_assignments(service_id)
  WHERE responsibility_role='owner';
ALTER TABLE public.service_department_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.service_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_code TEXT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  team_code TEXT,
  department_code TEXT,
  responsibility_role TEXT NOT NULL DEFAULT 'owner' CHECK (responsibility_role IN ('owner','collaborator')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_team_assignments_service_team_key UNIQUE(service_id, team_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_team_single_owner
  ON public.service_team_assignments(service_id)
  WHERE responsibility_role='owner';
ALTER TABLE public.service_team_assignments ENABLE ROW LEVEL SECURITY;
