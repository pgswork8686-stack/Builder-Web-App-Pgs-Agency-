-- ============================================================
-- Fix: phase3_set_completion_timestamps PL/pgSQL enum coercion
-- When executing on public.projects, evaluating NEW.status = 'done'
-- causes 22P02 invalid input value for enum project_status: "done"
-- Fixed by separating branch checks and casting status to text.
-- ============================================================

CREATE OR REPLACE FUNCTION public.phase3_set_completion_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    IF NEW.status::text = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.status::text = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
