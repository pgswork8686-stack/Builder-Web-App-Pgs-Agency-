CREATE UNIQUE INDEX IF NOT EXISTS uq_service_delivery_items_service_name_ci ON public.service_delivery_items(service_id, lower(btrim(name)));
