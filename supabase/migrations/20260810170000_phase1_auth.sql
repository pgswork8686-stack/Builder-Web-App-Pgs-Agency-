-- Migration: 20260810170000_phase1_auth.sql
-- Description: PGS Hub Phase 1 account lifecycle schema, enums, constraints, indexes, triggers, backfill script, and RLS policies.

-- 1. Create Enums for Roles and Account Status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'team_leader',
      'employee',
      'accountant',
      'client'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM (
      'pending',
      'active',
      'rejected'
    );
  END IF;
END $$;

-- 2. Create public.profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role DEFAULT NULL,
  account_status public.account_status NOT NULL DEFAULT 'pending',
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: active accounts must have non-null role; pending/rejected accounts must have null role
  CONSTRAINT check_role_status_consistency CHECK (
    (account_status = 'active' AND role IS NOT NULL) OR
    (account_status IN ('pending', 'rejected') AND role IS NULL)
  )
);

-- Partial Unique Index for Single Admin Policy (Enforces at most 1 profile can have role='admin')
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_single_admin
  ON public.profiles (role)
  WHERE (role = 'admin');

-- 3. Create public.account_approval_events Table
CREATE TABLE IF NOT EXISTS public.account_approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  previous_status public.account_status,
  new_status public.account_status,
  previous_role public.app_role,
  new_role public.app_role,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for account_approval_events performance
CREATE INDEX IF NOT EXISTS idx_account_approval_events_target_user
  ON public.account_approval_events(target_user_id);

CREATE INDEX IF NOT EXISTS idx_account_approval_events_actor
  ON public.account_approval_events(actor_id);

-- 4. Create Security Definer Auto-Creation Trigger Function for Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, account_status)
  VALUES (NEW.id, NULL, 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill Existing auth.users to public.profiles
INSERT INTO public.profiles (id, role, account_status)
SELECT id, NULL, 'pending'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 6. Helper Security Definer Function for Admin Checking
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

-- 7. Trigger to prevent direct UPDATE of role or account_status by authenticated actors
CREATE OR REPLACE FUNCTION public.prevent_direct_role_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.account_status IS DISTINCT FROM NEW.account_status) THEN
    IF (current_setting('request.jwt.claim.role', true) = 'authenticated') AND
       (current_setting('app.allow_role_status_update', true) IS DISTINCT FROM 'true') THEN
      RAISE EXCEPTION 'Direct modification of role or account_status is not allowed. Use administrative approval workflows.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_role_status_update ON public.profiles;
CREATE TRIGGER trg_prevent_direct_role_status_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_role_status_update();

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_approval_events ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for public.profiles
-- Users can SELECT own profile, Admin can SELECT all
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin(auth.uid())
  );

-- Users can UPDATE their own basic metadata (role & account_status changes are guarded by trigger)
DROP POLICY IF EXISTS "profiles_update_own_policy" ON public.profiles;
CREATE POLICY "profiles_update_own_policy"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: No DELETE policy is created for authenticated users, effectively prohibiting direct DELETE operations on profiles.

-- 10. RLS Policies for public.account_approval_events
-- Only Admin (or system via security definer) can SELECT approval events
DROP POLICY IF EXISTS "account_approval_events_admin_select" ON public.account_approval_events;
CREATE POLICY "account_approval_events_admin_select"
  ON public.account_approval_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Only Admin (or system via security definer) can INSERT approval events
DROP POLICY IF EXISTS "account_approval_events_admin_insert" ON public.account_approval_events;
CREATE POLICY "account_approval_events_admin_insert"
  ON public.account_approval_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
