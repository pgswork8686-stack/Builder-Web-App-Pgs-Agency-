-- Migration: 20260810180000_phase1_auth_fix_round1.sql
-- Description: Implement complete profiles schema, lifecycle check constraints, atomic operations (bootstrap, approve, reject), backfill scripts, and RLS/RBAC hardening.

-- 1. Upgrade public.profiles schema
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

-- 2. Clean old check constraint and enforce lifecycle consistency check constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_role_status_consistency;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_role_status_consistency CHECK (
    (account_status = 'pending' AND role IS NULL AND approved_at IS NULL AND rejected_at IS NULL) OR
    (account_status = 'active' AND role IS NOT NULL AND approved_at IS NOT NULL AND approved_by IS NOT NULL AND rejected_at IS NULL) OR
    (account_status = 'rejected' AND role IS NULL AND rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND approved_at IS NULL)
  );

-- 3. Update the handle_new_user() trigger function to extract metadata properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_provider TEXT;
BEGIN
  -- Extract full_name and avatar_url from metadata if they exist
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    );
    v_avatar_url := COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    );
  ELSE
    v_full_name := split_part(NEW.email, '@', 1);
    v_avatar_url := NULL;
  END IF;

  -- Determine provider from auth.users record or default to 'email'
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  INSERT INTO public.profiles (
    id,
    email,
    phone,
    full_name,
    avatar_url,
    auth_provider,
    role,
    account_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    v_full_name,
    v_avatar_url,
    v_provider,
    NULL,
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    auth_provider = EXCLUDED.auth_provider,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);

  RETURN NEW;
END;
;

-- 4. Backfill existing auth.users to public.profiles mapping fields correctly
DO 
DECLARE
  r RECORD;
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_provider TEXT;
BEGIN
  FOR r IN SELECT * FROM auth.users LOOP
    IF r.raw_user_meta_data IS NOT NULL THEN
      v_full_name := COALESCE(
        r.raw_user_meta_data->>'full_name',
        r.raw_user_meta_data->>'name',
        split_part(r.email, '@', 1)
      );
      v_avatar_url := COALESCE(
        r.raw_user_meta_data->>'avatar_url',
        r.raw_user_meta_data->>'picture'
      );
    ELSE
      v_full_name := split_part(r.email, '@', 1);
      v_avatar_url := NULL;
    END IF;

    v_provider := COALESCE(r.raw_app_meta_data->>'provider', 'email');

    INSERT INTO public.profiles (
      id,
      email,
      phone,
      full_name,
      avatar_url,
      auth_provider,
      role,
      account_status
    )
    VALUES (
      r.id,
      r.email,
      r.phone,
      v_full_name,
      v_avatar_url,
      v_provider,
      NULL,
      'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      auth_provider = EXCLUDED.auth_provider,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  END LOOP;
END ;

-- 5. Atomic PostgreSQL RPC/functions for elevated operations
-- A. bootstrap_initial_admin
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(
  p_admin_user_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_admin_count INT;
  v_profile RECORD;
BEGIN
  -- 1. Check if email matches target email
  IF LOWER(p_email) IS DISTINCT FROM LOWER(current_setting('app.initial_admin_email', true)) AND LOWER(p_email) IS DISTINCT FROM 'pgsword6868@gmail.com' THEN
    RAISE EXCEPTION 'Only designated initial admin email can perform bootstrap' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Count existing active admin accounts
  SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin' AND account_status = 'active';
  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'System already has bootstrapped admin account' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Get profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_admin_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile missing' USING ERRCODE = 'P0003';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Account is not in pending state' USING ERRCODE = 'P0004';
  END IF;

  -- Enable bypass trigger for role update
  SET LOCAL app.allow_role_status_update = 'true';

  -- 4. Perform atomic update
  UPDATE public.profiles
  SET
    role = 'admin',
    account_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = NOW()
  WHERE id = p_admin_user_id;

  -- 5. Insert approval event
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
;

-- B. approve_pending_account
CREATE OR REPLACE FUNCTION public.approve_pending_account(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_role public.app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_is_admin BOOLEAN;
  v_profile RECORD;
BEGIN
  -- 1. Check if caller is indeed admin
  SELECT public.is_admin(p_admin_user_id) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied. Actor must be an active admin' USING ERRCODE = 'P0005';
  END IF;

  -- 2. Reject role admin assignment via approval
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot assign admin role through user approval workflow' USING ERRCODE = 'P0006';
  END IF;

  -- 3. Fetch target profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found' USING ERRCODE = 'P0007';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Target account is not pending approval' USING ERRCODE = 'P0008';
  END IF;

  -- Enable bypass trigger for status/role update
  SET LOCAL app.allow_role_status_update = 'true';

  -- 4. Atomic update
  UPDATE public.profiles
  SET
    role = p_role,
    account_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = NOW(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = p_target_user_id;

  -- 5. Log audit event
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
    p_target_user_id,
    p_admin_user_id,
    'approve',
    'pending',
    'active',
    NULL,
    p_role,
    'Approved by admin'
  );

  RETURN jsonb_build_object(
    'success', true,
    'role', p_role,
    'status', 'active'
  );
END;
;

-- C. reject_pending_account
CREATE OR REPLACE FUNCTION public.reject_pending_account(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
DECLARE
  v_is_admin BOOLEAN;
  v_profile RECORD;
BEGIN
  -- 1. Check if caller is indeed admin
  SELECT public.is_admin(p_admin_user_id) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied. Actor must be an active admin' USING ERRCODE = 'P0005';
  END IF;

  -- 2. Validate reason length
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Invalid reason length. Rejection reason must be between 3 and 500 characters' USING ERRCODE = 'P0009';
  END IF;

  -- 3. Fetch target profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found' USING ERRCODE = 'P0007';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Target account is not pending approval' USING ERRCODE = 'P0008';
  END IF;

  -- Enable bypass trigger for status/role update
  SET LOCAL app.allow_role_status_update = 'true';

  -- 4. Atomic update
  UPDATE public.profiles
  SET
    role = NULL,
    account_status = 'rejected',
    rejected_by = p_admin_user_id,
    rejected_at = NOW(),
    rejection_reason = trim(p_reason),
    approved_by = NULL,
    approved_at = NULL
  WHERE id = p_target_user_id;

  -- 5. Log audit event
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
    p_target_user_id,
    p_admin_user_id,
    'reject',
    'pending',
    'rejected',
    NULL,
    NULL,
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'role', NULL,
    'status', 'rejected'
  );
END;
;

-- 6. Revoke direct execute permissions from public and non-elevated roles
REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_admin(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_pending_account(UUID, UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_pending_account(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Allow only service_role (system elevated client) to execute them
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_admin(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_pending_account(UUID, UUID, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_pending_account(UUID, UUID, TEXT) TO service_role;

-- 7. Audit account_approval_events table schema alignment
ALTER TABLE public.account_approval_events
  RENAME COLUMN target_user_id TO target_user;

ALTER TABLE public.account_approval_events
  RENAME COLUMN actor_id TO actor;

ALTER TABLE public.account_approval_events
  ADD COLUMN IF NOT EXISTS previous_status_text TEXT,
  ADD COLUMN IF NOT EXISTS new_status_text TEXT,
  ADD COLUMN IF NOT EXISTS previous_role_text TEXT,
  ADD COLUMN IF NOT EXISTS new_role_text TEXT;

-- Restructure trigger check for metadata vs security update
CREATE OR REPLACE FUNCTION public.prevent_direct_role_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS 
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) OR
     (OLD.account_status IS DISTINCT FROM NEW.account_status) OR
     (OLD.approved_by IS DISTINCT FROM NEW.approved_by) OR
     (OLD.approved_at IS DISTINCT FROM NEW.approved_at) OR
     (OLD.rejected_by IS DISTINCT FROM NEW.rejected_by) OR
     (OLD.rejected_at IS DISTINCT FROM NEW.rejected_at) OR
     (OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason) THEN

    IF (current_setting('request.jwt.claim.role', true) = 'authenticated') AND
       (current_setting('app.allow_role_status_update', true) IS DISTINCT FROM 'true') THEN
      RAISE EXCEPTION 'Direct modification of secure authentication role, status, or approvals is not allowed.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
;
