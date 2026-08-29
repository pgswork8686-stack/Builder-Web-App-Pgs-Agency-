-- Phase 1: replace destructive account deletion and non-atomic project
-- membership replacement with transaction-safe, service-role-only RPCs.

CREATE OR REPLACE FUNCTION public.phase1_terminate_account(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT 'Chấm dứt quyền truy cập bởi quản trị viên'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_reason text := nullif(btrim(p_reason), '');
BEGIN
  SELECT * INTO v_actor
  FROM public.profiles
  WHERE id = p_actor_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_actor.account_status IS DISTINCT FROM 'active' OR v_actor.role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'ACCOUNT_TERMINATION_ACTOR_DENIED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_TERMINATION_TARGET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_target_user_id = p_actor_user_id THEN
    RAISE EXCEPTION 'ACCOUNT_TERMINATION_SELF_DENIED' USING ERRCODE = 'P0001';
  END IF;

  IF v_target.account_status = 'rejected'
     AND coalesce(v_target.rejection_reason, '') LIKE 'TERMINATED:%' THEN
    RETURN jsonb_build_object(
      'success', true,
      'alreadyTerminated', true,
      'userId', p_target_user_id,
      'accountStatus', 'rejected',
      'employmentStatus', 'terminated'
    );
  END IF;

  IF v_target.role = 'admin' AND v_target.account_status = 'active' AND (
    SELECT count(*) FROM public.profiles
    WHERE role = 'admin' AND account_status = 'active'
  ) <= 1 THEN
    RAISE EXCEPTION 'ACCOUNT_TERMINATION_LAST_ADMIN_DENIED' USING ERRCODE = 'P0001';
  END IF;

  -- Clear current operational ownership. Historical creator/reviewer/audit links
  -- are deliberately retained.
  UPDATE public.departments
  SET head_user_id = NULL, updated_by = p_actor_user_id, updated_at = v_now
  WHERE head_user_id = p_target_user_id;

  UPDATE public.teams
  SET leader_user_id = NULL, updated_by = p_actor_user_id, updated_at = v_now
  WHERE leader_user_id = p_target_user_id;

  UPDATE public.employee_profiles
  SET reports_to_user_id = NULL, updated_by = p_actor_user_id, updated_at = v_now
  WHERE reports_to_user_id = p_target_user_id;

  UPDATE public.tasks
  SET assignee_user_id = NULL, updated_by = p_actor_user_id, updated_at = v_now
  WHERE assignee_user_id = p_target_user_id;

  UPDATE public.projects
  SET project_manager_user_id = NULL, updated_by = p_actor_user_id, updated_at = v_now
  WHERE project_manager_user_id = p_target_user_id;

  UPDATE public.support_tickets
  SET assignee_user_id = NULL, updated_at = v_now
  WHERE assignee_user_id = p_target_user_id;

  UPDATE public.workflow_approval_requests
  SET approver_user_id = NULL, updated_at = v_now
  WHERE approver_user_id = p_target_user_id AND status = 'pending';

  UPDATE public.employee_profiles
  SET employment_status = 'terminated',
      left_date = (v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
      updated_by = p_actor_user_id,
      updated_at = v_now
  WHERE user_id = p_target_user_id;

  UPDATE public.user_role_assignments
  SET active = false, revoked_at = coalesce(revoked_at, v_now)
  WHERE user_id = p_target_user_id AND active = true;

  -- The current account_status enum has no terminated value. Use its locked
  -- state while recording an explicit termination marker and preserving the
  -- Auth user plus all business history.
  UPDATE public.profiles
  SET account_status = 'rejected',
      role = NULL,
      approved_at = NULL,
      approved_by = NULL,
      rejected_at = v_now,
      rejected_by = p_actor_user_id,
      rejection_reason = 'TERMINATED: ' || coalesce(v_reason, 'Chấm dứt quyền truy cập bởi quản trị viên'),
      updated_at = v_now
  WHERE id = p_target_user_id;

  INSERT INTO public.account_approval_events (
    target_user,
    actor,
    action,
    previous_status,
    new_status,
    previous_role,
    new_role,
    notes,
    created_at
  ) VALUES (
    p_target_user_id,
    p_actor_user_id,
    'terminate',
    v_target.account_status,
    'rejected',
    v_target.role,
    NULL,
    coalesce(v_reason, 'Chấm dứt quyền truy cập bởi quản trị viên'),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'alreadyTerminated', false,
    'userId', p_target_user_id,
    'accountStatus', 'rejected',
    'employmentStatus', 'terminated'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.phase1_replace_user_project_memberships(
  p_target_user_id uuid,
  p_project_ids uuid[],
  p_project_role public.project_member_role,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_ids uuid[];
  v_expected_count integer;
  v_existing_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_user_id AND role = 'admin' AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'PROJECT_ASSIGNMENT_ACTOR_DENIED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_target_user_id AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'PROJECT_ASSIGNMENT_TARGET_INACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF array_position(coalesce(p_project_ids, ARRAY[]::uuid[]), NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ASSIGNMENT_INVALID_PROJECT_ID' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_project_ids
  FROM (
    SELECT DISTINCT unnest(coalesce(p_project_ids, ARRAY[]::uuid[])) AS id
  ) requested;

  v_expected_count := cardinality(v_project_ids);
  SELECT count(*) INTO v_existing_count
  FROM public.projects
  WHERE id = ANY(v_project_ids);

  IF v_existing_count <> v_expected_count THEN
    RAISE EXCEPTION 'PROJECT_ASSIGNMENT_PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE project_manager_user_id = p_target_user_id
      AND NOT (id = ANY(v_project_ids))
  ) THEN
    RAISE EXCEPTION 'PROJECT_MANAGER_MEMBERSHIP_REQUIRED' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.project_memberships
  WHERE user_id = p_target_user_id
    AND NOT (project_id = ANY(v_project_ids));

  INSERT INTO public.project_memberships (
    project_id, user_id, project_role, created_by, updated_at
  )
  SELECT project_id, p_target_user_id, p_project_role, p_actor_user_id, clock_timestamp()
  FROM unnest(v_project_ids) AS requested(project_id)
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET project_role = EXCLUDED.project_role,
      updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'userId', p_target_user_id,
    'membershipCount', v_expected_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase1_terminate_account(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase1_replace_user_project_memberships(uuid, uuid[], public.project_member_role, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_terminate_account(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase1_replace_user_project_memberships(uuid, uuid[], public.project_member_role, uuid) TO service_role;

-- RLS remains the primary direct-access boundary, but table grants must still
-- follow least privilege as defense in depth.
REVOKE ALL PRIVILEGES ON TABLE
  public.client_companies,
  public.client_memberships,
  public.departments,
  public.employee_profiles,
  public.profiles,
  public.service_department_assignments,
  public.service_team_assignments,
  public.teams
FROM anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
