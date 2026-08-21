-- Allow authenticated browser-scoped clients to read their own profile row.
-- Row visibility remains constrained by profiles_select_own_policy.
GRANT SELECT ON TABLE public.profiles TO authenticated;
