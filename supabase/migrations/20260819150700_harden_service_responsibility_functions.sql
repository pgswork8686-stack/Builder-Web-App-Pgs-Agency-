CREATE OR REPLACE FUNCTION public.sync_service_department_assignment_codes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  NEW.service_code := (SELECT service_code FROM public.services WHERE id=NEW.service_id);
  NEW.department_code := (SELECT department_code FROM public.departments WHERE id=NEW.department_id);
  NEW.created_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.created_by);
  NEW.updated_by_code := (SELECT account_code FROM public.profiles WHERE id=NEW.updated_by);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_service_team_assignment_codes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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

CREATE OR REPLACE FUNCTION public.validate_service_team_owner_department()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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

REVOKE ALL ON FUNCTION public.sync_service_department_assignment_codes()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_service_team_assignment_codes()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_service_team_owner_department()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_service_department_assignment_codes()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_service_team_assignment_codes()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_service_team_owner_department()
  TO service_role;
