-- ==========================================================================
-- Phase 8: Lock down legacy SECURITY DEFINER helpers exposed through PostgREST
-- --------------------------------------------------------------------------
-- These helpers are used by triggers, older admin RPCs, or historical RLS.
-- They should not be directly callable by browser roles.
-- ==========================================================================

-- Keep authenticated profile bootstrap/resolve working without requiring
-- browser execute access to public.is_admin(uuid).
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_policy" ON public.profiles;
CREATE POLICY "profiles_select_own_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Account approval events are owned by Nest/service_role. Avoid browser RLS
-- policies that depend on SECURITY DEFINER admin helpers.
DROP POLICY IF EXISTS "account_approval_events_admin_select"
  ON public.account_approval_events;
DROP POLICY IF EXISTS "account_approval_events_admin_insert"
  ON public.account_approval_events;

REVOKE ALL ON TABLE public.account_approval_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_approval_events
  TO service_role;

REVOKE ALL ON FUNCTION public.check_client_membership_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_employee_profile_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_team_leader_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_direct_role_status_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_client_membership_role()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.check_employee_profile_role()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.check_team_leader_role()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_direct_role_status_update()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at()
  TO service_role;
