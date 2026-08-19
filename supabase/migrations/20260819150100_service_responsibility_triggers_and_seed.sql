CREATE INDEX IF NOT EXISTS idx_service_department_assignments_department
  ON public.service_department_assignments(department_id,responsibility_role);
CREATE INDEX IF NOT EXISTS idx_service_team_assignments_team
  ON public.service_team_assignments(team_id,responsibility_role);
CREATE INDEX IF NOT EXISTS idx_teams_department_active
  ON public.teams(department_id,is_active);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department_team
  ON public.employee_profiles(department_id,team_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_reports_to
  ON public.employee_profiles(reports_to_user_id);

CREATE OR REPLACE FUNCTION public.sync_service_department_assignment_codes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.service_code := (SELECT service_code FROM public.services WHERE id=NEW.service_id);
  NEW.department_code := (SELECT department_code FROM public.departments WHERE id=NEW.department_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.updated_by);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_service_department_assignment_codes
  ON public.service_department_assignments;
CREATE TRIGGER trg_sync_service_department_assignment_codes
  BEFORE INSERT OR UPDATE ON public.service_department_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_service_department_assignment_codes();

CREATE OR REPLACE FUNCTION public.sync_service_team_assignment_codes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.service_code := (SELECT service_code FROM public.services WHERE id=NEW.service_id);
  SELECT t.team_code,t.department_code
    INTO NEW.team_code,NEW.department_code
  FROM public.teams t WHERE t.id=NEW.team_id;
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.updated_by);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_service_team_assignment_codes
  ON public.service_team_assignments;
CREATE TRIGGER trg_sync_service_team_assignment_codes
  BEFORE INSERT OR UPDATE ON public.service_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_service_team_assignment_codes();

CREATE OR REPLACE FUNCTION public.validate_service_team_owner_department()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_team_department_id UUID;
  v_owner_department_id UUID;
BEGIN
  IF NEW.responsibility_role='owner' THEN
    SELECT department_id INTO v_team_department_id
    FROM public.teams WHERE id=NEW.team_id;

    SELECT department_id INTO v_owner_department_id
    FROM public.service_department_assignments
    WHERE service_id=NEW.service_id AND responsibility_role='owner';

    IF v_owner_department_id IS NULL THEN
      RAISE EXCEPTION 'Service must have an owner department before assigning an owner team'
        USING ERRCODE='P3101';
    END IF;
    IF v_team_department_id IS DISTINCT FROM v_owner_department_id THEN
      RAISE EXCEPTION 'Owner team must belong to the service owner department'
        USING ERRCODE='P3102';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_service_team_owner_department
  ON public.service_team_assignments;
CREATE TRIGGER trg_validate_service_team_owner_department
  BEFORE INSERT OR UPDATE OF service_id,team_id,responsibility_role
  ON public.service_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_service_team_owner_department();

WITH mapping(service_code,department_code) AS (
  VALUES
  ('DV_01','PB_02'),('DV_02','PB_02'),('DV_03','PB_02'),
  ('DV_04','PB_03'),('DV_05','PB_03'),('DV_06','PB_03'),
  ('DV_07','PB_04'),('DV_08','PB_04'),('DV_09','PB_04'),
  ('DV_10','PB_05'),('DV_11','PB_05'),('DV_12','PB_05'),
  ('DV_13','PB_05'),('DV_14','PB_05'),
  ('DV_15','PB_07'),('DV_16','PB_07'),('DV_17','PB_07'),
  ('DV_18','PB_05'),('DV_19','PB_05'),
  ('DV_20','PB_06'),('DV_21','PB_06'),('DV_22','PB_06'),
  ('DV_23','PB_06'),('DV_24','PB_06'),('DV_25','PB_06'),('DV_26','PB_06')
)
INSERT INTO public.service_department_assignments(service_id,department_id,responsibility_role)
SELECT s.id,d.id,'owner'
FROM mapping m
JOIN public.services s ON s.service_code=m.service_code
JOIN public.departments d ON d.department_code=m.department_code
ON CONFLICT(service_id,department_id)
DO UPDATE SET responsibility_role=EXCLUDED.responsibility_role;
