CREATE OR REPLACE VIEW public.admin_service_responsibility_v
WITH (security_invoker=true) AS
SELECT
  s.id AS service_id,
  s.service_code,
  s.name AS service_name,
  sc.service_category_code,
  sc.name AS service_category_name,
  sda.department_id AS owner_department_id,
  sda.department_code AS owner_department_code,
  d.name AS owner_department_name,
  sta.team_id AS owner_team_id,
  sta.team_code AS owner_team_code,
  t.name AS owner_team_name,
  COUNT(sdi.id) FILTER (WHERE sdi.active) AS active_delivery_items_count
FROM public.services s
LEFT JOIN public.service_categories sc ON sc.id=s.service_category_id
LEFT JOIN public.service_department_assignments sda
  ON sda.service_id=s.id AND sda.responsibility_role='owner'
LEFT JOIN public.departments d ON d.id=sda.department_id
LEFT JOIN public.service_team_assignments sta
  ON sta.service_id=s.id AND sta.responsibility_role='owner'
LEFT JOIN public.teams t ON t.id=sta.team_id
LEFT JOIN public.service_delivery_items sdi ON sdi.service_id=s.id
GROUP BY
  s.id,s.service_code,s.name,sc.service_category_code,sc.name,
  sda.department_id,sda.department_code,d.name,
  sta.team_id,sta.team_code,t.name;

REVOKE ALL ON public.admin_service_responsibility_v FROM anon,authenticated;
GRANT SELECT ON public.admin_service_responsibility_v TO service_role;
