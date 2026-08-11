-- ============================================================
-- Phase 2 Follow-up Migration (Final)
-- 20260811120000_phase2_fix_round1.sql
--
-- Applied after:
--   20260811110000_phase2_organization_people_clients.sql
--
-- Requires: public.set_updated_at() from Phase 1
-- ============================================================

-- ==================================================
-- 1. client_memberships: add updated_at + trigger
-- ==================================================

ALTER TABLE public.client_memberships
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_set_updated_at_client_memberships
  ON public.client_memberships;

CREATE TRIGGER trigger_set_updated_at_client_memberships
  BEFORE UPDATE ON public.client_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ==================================================
-- 2. create_client_membership_atomic
-- ==================================================

DROP FUNCTION IF EXISTS public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.create_client_membership_atomic(
  p_company_id  UUID,
  p_user_id     UUID,
  p_title       TEXT,
  p_is_primary  BOOLEAN,
  p_created_by  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role    public.app_role;
  v_user_status  TEXT;
  v_result       JSONB;
BEGIN
  -- Validate company exists
  PERFORM 1 FROM public.client_companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLIENT_COMPANY_NOT_FOUND' USING ERRCODE = 'P0005';
  END IF;

  -- Validate user profile
  SELECT role, account_status
  INTO v_user_role, v_user_status
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

  -- Acquire row-level lock on all user memberships before mutation
  PERFORM 1
  FROM public.client_memberships
  WHERE user_id = p_user_id
  ORDER BY id
  FOR UPDATE;

  -- Atomically reset other primary memberships
  IF p_is_primary = true THEN
    UPDATE public.client_memberships
    SET is_primary = false
    WHERE user_id = p_user_id;
  END IF;

  -- Insert new membership
  INSERT INTO public.client_memberships AS membership (
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
  RETURNING jsonb_build_object(
    'id',                membership.id,
    'client_company_id', membership.client_company_id,
    'user_id',           membership.user_id,
    'title',             membership.title,
    'is_primary',        membership.is_primary,
    'created_at',        membership.created_at,
    'updated_at',        membership.updated_at
  ) INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MEMBERSHIP_DUPLICATE' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, UUID)
  TO service_role;


-- ==================================================
-- 3. update_client_membership_atomic
--    Drop any old 4-arg signature, create 6-arg final
-- ==================================================

DROP FUNCTION IF EXISTS public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.update_client_membership_atomic(
  p_company_id         UUID,
  p_membership_id      UUID,
  p_title              TEXT,
  p_title_provided     BOOLEAN,
  p_is_primary         BOOLEAN,
  p_is_primary_provided BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id            UUID;
  v_current_title      TEXT;
  v_current_is_primary BOOLEAN;
  v_new_title          TEXT;
  v_new_is_primary     BOOLEAN;
  v_result             JSONB;
BEGIN
  -- Lock and fetch current state atomically
  SELECT user_id, title, is_primary
  INTO   v_user_id, v_current_title, v_current_is_primary
  FROM   public.client_memberships
  WHERE  id               = p_membership_id
    AND  client_company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Compute effective new values (partial PATCH semantics)
  v_new_title      := CASE WHEN p_title_provided      THEN p_title      ELSE v_current_title      END;
  v_new_is_primary := CASE WHEN p_is_primary_provided THEN p_is_primary ELSE v_current_is_primary END;

  -- Reset OTHER memberships only when explicitly setting primary = true
  IF p_is_primary_provided AND p_is_primary = true THEN
    UPDATE public.client_memberships
    SET    is_primary = false
    WHERE  user_id = v_user_id
      AND  id      <> p_membership_id;
  END IF;

  -- Update target row (trigger sets updated_at automatically)
  UPDATE public.client_memberships
  SET
    title      = v_new_title,
    is_primary = v_new_is_primary
  WHERE id = p_membership_id;

  -- Return final state
  SELECT jsonb_build_object(
    'id',               id,
    'client_company_id', client_company_id,
    'user_id',          user_id,
    'title',            title,
    'is_primary',       is_primary,
    'updated_at',       updated_at
  )
  INTO v_result
  FROM public.client_memberships
  WHERE id = p_membership_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_membership_atomic(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN)
  TO service_role;


-- ==================================================
-- 4. search_people_directory
--    Returns JSONB: { "items": [...], "total": N }
--    Guarantees correct total even on empty page
-- ==================================================

DROP FUNCTION IF EXISTS public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.search_people_directory(
  p_query            TEXT                      DEFAULT NULL,
  p_role             public.app_role           DEFAULT NULL,
  p_department_id    UUID                      DEFAULT NULL,
  p_team_id          UUID                      DEFAULT NULL,
  p_employment_status public.employment_status DEFAULT NULL,
  p_offset           INTEGER                   DEFAULT 0,
  p_limit            INTEGER                   DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit  INTEGER;
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  -- Guard: clamp limit and offset
  v_limit  := LEAST(100, GREATEST(1, COALESCE(p_limit,  20)));
  v_offset := GREATEST(0,             COALESCE(p_offset,  0));

  WITH filtered AS (
    SELECT
      p.id,
      p.email::TEXT           AS email,
      p.phone::TEXT           AS phone,
      p.full_name::TEXT       AS full_name,
      p.avatar_url::TEXT      AS avatar_url,
      p.role,
      p.account_status::TEXT  AS account_status,
      p.created_at,
      ep.employee_code::TEXT  AS employee_code,
      ep.department_id,
      d.name::TEXT            AS department_name,
      ep.team_id,
      t.name::TEXT            AS team_name,
      ep.job_title::TEXT      AS job_title,
      ep.reports_to_user_id,
      ep.employment_status,
      ep.joined_date,
      ep.left_date
    FROM public.profiles p
    LEFT JOIN public.employee_profiles ep ON p.id = ep.user_id
    LEFT JOIN public.departments d        ON ep.department_id = d.id
    LEFT JOIN public.teams t              ON ep.team_id       = t.id
    WHERE
      (p_role              IS NULL OR p.role              = p_role)
      AND (p_department_id IS NULL OR ep.department_id   = p_department_id)
      AND (p_team_id       IS NULL OR ep.team_id         = p_team_id)
      AND (p_employment_status IS NULL OR ep.employment_status = p_employment_status)
      AND (
        p_query IS NULL OR p_query = ''
        OR p.full_name     ILIKE '%' || p_query || '%'
        OR p.email         ILIKE '%' || p_query || '%'
        OR ep.employee_code ILIKE '%' || p_query || '%'
      )
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',                 f.id,
            'email',              f.email,
            'phone',              f.phone,
            'full_name',          f.full_name,
            'avatar_url',         f.avatar_url,
            'role',               f.role,
            'account_status',     f.account_status,
            'employee_code',      f.employee_code,
            'department_id',      f.department_id,
            'department_name',    f.department_name,
            'team_id',            f.team_id,
            'team_name',          f.team_name,
            'job_title',          f.job_title,
            'reports_to_user_id', f.reports_to_user_id,
            'employment_status',  f.employment_status,
            'joined_date',        f.joined_date,
            'left_date',          f.left_date
          )
          ORDER BY f.created_at DESC, f.id DESC
        )
        FROM (
          SELECT * FROM filtered
          ORDER BY created_at DESC, id DESC
          LIMIT v_limit OFFSET v_offset
        ) f
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_people_directory(TEXT, public.app_role, UUID, UUID, public.employment_status, INTEGER, INTEGER)
  TO service_role;
