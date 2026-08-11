-- Phase 2 Fix Round 1 Migrations
-- Timestamp: 20260811120000

-- ==================================================
-- 1. ATOMIC CLIENT MEMBERSHIP FUNCTIONS
-- ==================================================

-- RPC: create_client_membership_atomic
CREATE OR REPLACE FUNCTION public.create_client_membership_atomic(
  p_company_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_is_primary BOOLEAN,
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_membership_id UUID;
  v_user_role public.app_role;
  v_user_status TEXT;
  v_result JSONB;
BEGIN
  -- Verify target user role and status
  SELECT role, account_status INTO v_user_role, v_user_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_user_role != 'client' THEN
    RAISE EXCEPTION 'USER_NOT_A_CLIENT' USING ERRCODE = 'P0003';
  END IF;

  IF v_user_status != 'active' THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = 'P0004';
  END IF;

  -- Atomic isolation: Reset previous primary memberships if p_is_primary is true
  IF p_is_primary = true THEN
    UPDATE public.client_memberships
    SET is_primary = false
    WHERE user_id = p_user_id;
  END IF;

  -- Insert new membership
  INSERT INTO public.client_memberships (
    client_company_id,
    user_id,
    title,
    is_primary,
    created_by
  ) VALUES (
    p_company_id,
    p_user_id,
    p_title,
    p_is_primary,
    p_created_by
  )
  RETURNING id INTO v_membership_id;

  v_result := jsonb_build_object(
    'id', v_membership_id,
    'client_company_id', p_company_id,
    'user_id', p_user_id,
    'title', p_title,
    'is_primary', p_is_primary
  );

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MEMBERSHIP_DUPLICATE' USING ERRCODE = '23505';
END;
$$;

-- RPC: update_client_membership_atomic
CREATE OR REPLACE FUNCTION public.update_client_membership_atomic(
  p_company_id UUID,
  p_membership_id UUID,
  p_title TEXT,
  p_is_primary BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Verify membership existence and company match
  SELECT user_id INTO v_user_id
  FROM public.client_memberships
  WHERE id = p_membership_id AND client_company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Atomic isolation: Reset previous primary memberships if p_is_primary is true
  IF p_is_primary = true THEN
    UPDATE public.client_memberships
    SET is_primary = false
    WHERE user_id = v_user_id;
  END IF;

  -- Update membership
  UPDATE public.client_memberships
  SET
    title = p_title,
    is_primary = p_is_primary,
    updated_at = NOW()
  WHERE id = p_membership_id AND client_company_id = p_company_id;

  v_result := jsonb_build_object(
    'id', p_membership_id,
    'client_company_id', p_company_id,
    'user_id', v_user_id,
    'title', p_title,
    'is_primary', p_is_primary
  );

  RETURN v_result;
END;
$$;

-- Revoke and Grant Permissions for Membership functions
REVOKE ALL ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN) TO service_role;


-- ==================================================
-- 2. PEOPLE DIRECTORY DB-SIDE SEARCH RPC
-- ==================================================

-- RPC: search_people_directory
CREATE OR REPLACE FUNCTION public.search_people_directory(
  p_query TEXT DEFAULT NULL,
  p_role public.app_role DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_employment_status public.employment_status DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role public.app_role,
  account_status TEXT,
  employee_code TEXT,
  department_id UUID,
  department_name TEXT,
  team_id UUID,
  team_name TEXT,
  job_title TEXT,
  reports_to_user_id UUID,
  employment_status public.employment_status,
  joined_date DATE,
  left_date DATE,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_profiles AS (
    SELECT
      p.id AS f_id,
      p.email AS f_email,
      p.phone AS f_phone,
      p.full_name AS f_full_name,
      p.avatar_url AS f_avatar_url,
      p.role AS f_role,
      p.account_status AS f_account_status,
      ep.employee_code AS f_employee_code,
      ep.department_id AS f_department_id,
      d.name AS f_department_name,
      ep.team_id AS f_team_id,
      t.name AS f_team_name,
      ep.job_title AS f_job_title,
      ep.reports_to_user_id AS f_reports_to_user_id,
      ep.employment_status AS f_employment_status,
      ep.joined_date AS f_joined_date,
      ep.left_date AS f_left_date
    FROM public.profiles p
    LEFT JOIN public.employee_profiles ep ON p.id = ep.user_id
    LEFT JOIN public.departments d ON ep.department_id = d.id
    LEFT JOIN public.teams t ON ep.team_id = t.id
    WHERE
      -- Filtering by role
      (p_role IS NULL OR p.role = p_role)
      -- Filtering by department
      AND (p_department_id IS NULL OR ep.department_id = p_department_id)
      -- Filtering by team
      AND (p_team_id IS NULL OR ep.team_id = p_team_id)
      -- Filtering by employment status
      AND (p_employment_status IS NULL OR ep.employment_status = p_employment_status)
      -- Free text search on full_name, email, and employee_code
      AND (
        p_query IS NULL OR p_query = ''
        OR p.full_name ILIKE '%' || p_query || '%'
        OR p.email ILIKE '%' || p_query || '%'
        OR ep.employee_code ILIKE '%' || p_query || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS full_count FROM filtered_profiles
  )
  SELECT
    fp.f_id AS id,
    fp.f_email::TEXT AS email,
    fp.f_phone::TEXT AS phone,
    fp.f_full_name::TEXT AS full_name,
    fp.f_avatar_url::TEXT AS avatar_url,
    fp.f_role AS role,
    fp.f_account_status AS account_status,
    fp.f_employee_code::TEXT AS employee_code,
    fp.f_department_id AS department_id,
    fp.f_department_name::TEXT AS department_name,
    fp.f_team_id AS team_id,
    fp.f_team_name::TEXT AS team_name,
    fp.f_job_title::TEXT AS job_title,
    fp.f_reports_to_user_id AS reports_to_user_id,
    fp.f_employment_status AS employment_status,
    fp.f_joined_date AS joined_date,
    fp.f_left_date AS left_date,
    c.full_count AS total_count
  FROM filtered_profiles fp
  CROSS JOIN counted c
  ORDER BY fp.f_id DESC  -- Stable secondary sort order
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Revoke and Grant Permissions for Search function
REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) TO service_role;
