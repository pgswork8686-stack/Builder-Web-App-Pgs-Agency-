-- ==========================================================================
-- Defense-in-Depth Row Level Security (RLS) Policies
-- Timestamp: 20260907100000_defense_in_depth_rls_policies.sql
-- --------------------------------------------------------------------------
-- Establishes authoritative, fine-grained PostgREST database policies for
-- authenticated users across payroll, finance, documents, attendance, and leave.
-- ==========================================================================

-- 1. PAYSLIPS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payslips_select_policy" ON public.payslips;
CREATE POLICY "payslips_select_policy"
  ON public.payslips
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'accountant')
    )
  );

-- 2. PAYROLL RUNS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_runs_select_policy" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select_policy"
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'accountant')
    )
  );

-- 3. EMPLOYEE PROFILES
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_profiles_select_policy" ON public.employee_profiles;
CREATE POLICY "employee_profiles_select_policy"
  ON public.employee_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'accountant', 'team_leader')
    )
  );

-- 4. CONTRACTS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select_policy" ON public.contracts;
CREATE POLICY "contracts_select_policy"
  ON public.contracts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'accountant', 'team_leader')
    )
    OR (
      client_visible = TRUE
      AND EXISTS (
        SELECT 1 FROM public.client_memberships cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.client_company_id = contracts.client_company_id
          AND cm.status = 'active'
      )
    )
  );

-- 5. INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'accountant')
    )
    OR (
      client_visible = TRUE
      AND EXISTS (
        SELECT 1 FROM public.client_memberships cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.client_company_id = invoices.client_company_id
          AND cm.status = 'active'
      )
    )
  );

-- 6. COMPANY DOCUMENTS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_documents_select_policy" ON public.company_documents;
CREATE POLICY "company_documents_select_policy"
  ON public.company_documents
  FOR SELECT
  TO authenticated
  USING (
    delete_status = 'active'
    AND (
      access_level = 'public_company'
      OR (
        access_level = 'internal_only'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.role IN ('admin', 'team_leader', 'employee', 'accountant')
        )
      )
      OR (
        access_level = 'management_only'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.role IN ('admin', 'team_leader')
        )
      )
    )
  );

-- 7. LEAVE REQUESTS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_select_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_select_policy"
  ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'team_leader')
    )
  );

-- 8. ATTENDANCE RECORDS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_records_select_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_select_policy"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'team_leader', 'accountant')
    )
  );
