BEGIN;

-- AuthGuard resolves the authenticated user's own profile through a
-- user-scoped Supabase client. The table privilege opens the SELECT path;
-- profiles_select_own_policy remains responsible for row isolation.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.profiles TO authenticated;

DO $$
BEGIN
  IF NOT has_table_privilege(
    'authenticated',
    'public.profiles',
    'SELECT'
  ) THEN
    RAISE EXCEPTION
      'profiles SELECT privilege missing for authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS table_class
    JOIN pg_namespace AS table_schema
      ON table_schema.oid = table_class.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_class.relname = 'profiles'
      AND table_class.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'profiles RLS must remain enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own_policy'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION
      'profiles_select_own_policy missing for authenticated';
  END IF;
END
$$;

COMMIT;
