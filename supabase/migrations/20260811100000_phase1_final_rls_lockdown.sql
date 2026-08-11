-- 1. Drop old profiles select policy
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 2. Create own-only profiles select policy (Admin cannot SELECT others directly from browser)
CREATE POLICY "profiles_select_own_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- 3. Drop old account_approval_events select policy (Admin cannot SELECT audit logs directly from browser)
DROP POLICY IF EXISTS "account_approval_events_admin_select" ON public.account_approval_events;
