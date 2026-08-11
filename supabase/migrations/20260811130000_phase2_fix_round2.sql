-- Phase 2 Fix Round 2
-- Timestamp: 20260811130000

-- ==================================================
-- 1. UPDATE update_client_membership_atomic
--    Add p_title_provided and p_is_primary_provided flags
--    for true partial PATCH semantics
-- ==================================================

CREATE OR REPLACE FUNCTION public.update_client_membership_atomic(
  p_company_id UUID,
  p_membership_id UUID,
  p_title TEXT,
  p_title_provided BOOLEAN,
  p_is_primary BOOLEAN,
  p_is_primary_provided BOOLEAN
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

  -- Atomic isolation: Reset previous primary memberships only if is_primary is being set to true
  IF p_is_primary_provided AND p_is_primary = true THEN
    UPDATE public.client_memberships
    SET is_primary = false
    WHERE user_id = v_user_id
      AND id != p_membership_id;
  END IF;

  -- Partial update: only touch fields that were provided
  UPDATE public.client_memberships
  SET
    title        = CASE WHEN p_title_provided     THEN p_title     ELSE title     END,
    is_primary   = CASE WHEN p_is_primary_provided THEN p_is_primary ELSE is_primary END,
    updated_at   = NOW()
  WHERE id = p_membership_id AND client_company_id = p_company_id;

  v_result := jsonb_build_object(
    'id', p_membership_id,
    'client_company_id', p_company_id,
    'user_id', v_user_id
  );

  RETURN v_result;
END;
$$;

-- Revoke/Grant for updated signature
REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

-- Drop old 4-argument signature so it cannot be called
DROP FUNCTION IF EXISTS public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN);


-- ==================================================
-- 2. REPLACE search_people_directory
--    Fixes:
--    a) Empty-page still returns total_count via window function
--    b) Stable ORDER BY created_at DESC, id DESC
--    c) LEAST(p_limit, 100) guard
--    d) account_status explicit TEXT cast (column is text enum-like)
-- ==================================================

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
DECLARE
  v_limit INTEGER;
BEGIN
  -- Guard: clamp limit to max 100
  v_limit := LEAST(GREATEST(p_limit, 1), 100);

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id              AS b_id,
      p.email           AS b_email,
      p.phone           AS b_phone,
      p.full_name       AS b_full_name,
      p.avatar_url      AS b_avatar_url,
      p.role            AS b_role,
      p.account_status::TEXT AS b_account_status,
      p.created_at      AS b_created_at,
      ep.employee_code  AS b_employee_code,
      ep.department_id  AS b_department_id,
      d.name            AS b_department_name,
      ep.team_id        AS b_team_id,
      t.name            AS b_team_name,
      ep.job_title      AS b_job_title,
      ep.reports_to_user_id AS b_reports_to_user_id,
      ep.employment_status  AS b_employment_status,
      ep.joined_date    AS b_joined_date,
      ep.left_date      AS b_left_date
    FROM public.profiles p
    LEFT JOIN public.employee_profiles ep ON p.id = ep.user_id
    LEFT JOIN public.departments d ON ep.department_id = d.id
    LEFT JOIN public.teams t ON ep.team_id = t.id
    WHERE
      (p_role IS NULL OR p.role = p_role)
      AND (p_department_id IS NULL OR ep.department_id = p_department_id)
      AND (p_team_id IS NULL OR ep.team_id = p_team_id)
      AND (p_employment_status IS NULL OR ep.employment_status = p_employment_status)
      AND (
        p_query IS NULL OR p_query = ''
        OR p.full_name ILIKE '%' || p_query || '%'
        OR p.email ILIKE '%' || p_query || '%'
        OR ep.employee_code ILIKE '%' || p_query || '%'
      )
  ),
  windowed AS (
    SELECT
      b.*,
      COUNT(*) OVER () AS w_total_count
    FROM base b
    ORDER BY b.b_created_at DESC, b.b_id DESC
    LIMIT v_limit
    OFFSET p_offset
  )
  SELECT
    w.b_id              AS id,
    w.b_email::TEXT     AS email,
    w.b_phone::TEXT     AS phone,
    w.b_full_name::TEXT AS full_name,
    w.b_avatar_url::TEXT AS avatar_url,
    w.b_role            AS role,
    w.b_account_status  AS account_status,
    w.b_employee_code::TEXT AS employee_code,
    w.b_department_id   AS department_id,
    w.b_department_name::TEXT AS department_name,
    w.b_team_id         AS team_id,
    w.b_team_name::TEXT AS team_name,
    w.b_job_title::TEXT AS job_title,
    w.b_reports_to_user_id AS reports_to_user_id,
    w.b_employment_status  AS employment_status,
    w.b_joined_date     AS joined_date,
    w.b_left_date       AS left_date,
    w.w_total_count     AS total_count
  FROM windowed w;
END;
$$;

-- Revoke/Grant for updated search function
REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER) TO service_role;
