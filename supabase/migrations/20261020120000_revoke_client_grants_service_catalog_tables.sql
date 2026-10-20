-- ============================================================
-- Migration: Revoke direct client grants on service catalog tables
-- Timestamp: 20261020120000_revoke_client_grants_service_catalog_tables.sql
--
-- service_categories, service_delivery_items and project_service_items were
-- the only public tables still carrying Supabase default grants for anon and
-- authenticated (including TRUNCATE, which RLS does not govern). They have RLS
-- enabled with no policies and are only accessed by the NestJS API through
-- service_role, so client roles need no table privileges. Same pattern as
-- 20260826024721_production_audit_hardening.sql.
-- ============================================================

REVOKE ALL ON public.service_categories, public.service_delivery_items, public.project_service_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories, public.service_delivery_items, public.project_service_items
  TO service_role;

DO $block$
DECLARE
  v_table text;
  v_role text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['public.service_categories', 'public.service_delivery_items', 'public.project_service_items'] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(v_role, v_table, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        RAISE EXCEPTION 'Role % still has privileges on %', v_role, v_table;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', v_table, 'SELECT')
      OR NOT has_table_privilege('service_role', v_table, 'INSERT')
      OR NOT has_table_privilege('service_role', v_table, 'UPDATE')
      OR NOT has_table_privilege('service_role', v_table, 'DELETE') THEN
      RAISE EXCEPTION 'service_role lost required privileges on %', v_table;
    END IF;
  END LOOP;
END $block$;
