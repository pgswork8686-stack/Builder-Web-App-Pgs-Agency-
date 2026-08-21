-- SECURITY: trigger helper functions in public execute with definer rights.
-- Browser roles must never be able to invoke them directly. Existing functions
-- are handled dynamically so this also covers overloaded signatures safely.
DO $$
DECLARE
  function_identity text;
BEGIN
  FOR function_identity IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_identity
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      function_identity
    );
  END LOOP;
END;
$$;

-- New public functions created by the migration owner should begin closed as
-- well. Service-role access is granted explicitly by the release bootstrap.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
