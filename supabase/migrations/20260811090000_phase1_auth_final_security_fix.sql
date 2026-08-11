-- 1. Drop direct profiles UPDATE policy (no direct browser update allowed)
DROP POLICY IF EXISTS "profiles_update_own_policy" ON public.profiles;

-- 2. Drop direct account_approval_events INSERT policy (only NestJS server with service_role can write logs)
DROP POLICY IF EXISTS "account_approval_events_admin_insert" ON public.account_approval_events;

-- 3. Drop old bootstrap RPC signature
DROP FUNCTION IF EXISTS public.bootstrap_initial_admin(UUID, TEXT);

-- 4. Create new bootstrap RPC signature without hardcoded email check in SQL
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_count INT;
  v_profile RECORD;
BEGIN
  -- 1. Count existing active admin accounts
  SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin' AND account_status = 'active';
  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'System already has bootstrapped admin account' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Get profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_admin_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile missing' USING ERRCODE = 'P0003';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Account is not in pending state' USING ERRCODE = 'P0004';
  END IF;

  -- Enable bypass trigger for role update
  SET LOCAL app.allow_role_status_update = 'true';

  -- 3. Perform atomic update
  UPDATE public.profiles
  SET
    role = 'admin',
    account_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = NOW()
  WHERE id = p_admin_user_id;

  -- 4. Insert approval event
  INSERT INTO public.account_approval_events (
    target_user,
    actor,
    action,
    previous_status,
    new_status,
    previous_role,
    new_role,
    notes
  )
  VALUES (
    p_admin_user_id,
    p_admin_user_id,
    'bootstrap_admin',
    'pending',
    'active',
    NULL,
    'admin',
    'Initial system bootstrap'
  );

  RETURN jsonb_build_object(
    'success', true,
    'role', 'admin',
    'status', 'active'
  );
END;
$$;

-- 5. Revoke direct execute permissions from public/anon/authenticated on new function
REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_admin(UUID) FROM PUBLIC, anon, authenticated;

-- 6. Grant execute ONLY to service_role (elevated backend system client)
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_admin(UUID) TO service_role;
