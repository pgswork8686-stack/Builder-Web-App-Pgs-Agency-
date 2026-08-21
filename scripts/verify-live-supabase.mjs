throw new Error(
  'verify-live-supabase.mjs is intentionally disabled. Release verification must use a disposable local PostgreSQL/Supabase environment via pnpm test:release-migrations; this repository must not access hosted Supabase from a local verification script.',
);
