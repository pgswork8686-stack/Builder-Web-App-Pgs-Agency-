-- ============================================================
-- Migration: Reconcile Service Catalog Business Codes & Snapshots
-- Timestamp: 20260819140000_reconcile_service_catalog_business_codes.sql
-- Description:
--   Forward-only reconciliation migration from production source state:
--   1. Reconciles service_categories: NHDV_XX codes, sequence, companions, format check, immutability.
--   2. Reconciles services: companion service_category_code, created_by_code, updated_by_code.
--   3. Reconciles service_delivery_items: HMDV_XX codes, legacy code auto-population, is_required, sequence, companions, active column convention.
--   4. Reconciles project_services: DVDA_XX codes, sequence, companions.
--   5. Reconciles project_service_items: HMDA_XX codes, sequence, companions, status enum, is_required.
--   6. Reconciles tasks: companion project_service_item_code, cross-project link rejection trigger.
--   7. Reconciles departments: sort_order backfilled PB_01=1..PB_09=9.
--   8. Single DB Trigger owner for snapshotting delivery items upon project_service insertion copying is_required.
-- ============================================================

-- ============================================================
-- 1. SERVICE CATEGORIES (NHDV_XX)
-- ============================================================

ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS service_category_code TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

CREATE SEQUENCE IF NOT EXISTS public.service_categories_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generation trigger for NHDV_XX
CREATE OR REPLACE FUNCTION public.set_service_category_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_category_code IS NULL OR btrim(NEW.service_category_code) = '' THEN
    NEW.service_category_code := public.format_business_code(
      'NHDV',
      nextval('public.service_categories_code_seq')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_categories_set_code ON public.service_categories;
CREATE TRIGGER trg_service_categories_set_code
  BEFORE INSERT ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_category_code();

DROP TRIGGER IF EXISTS trg_service_categories_code_immutable ON public.service_categories;
CREATE TRIGGER trg_service_categories_code_immutable
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('service_category_code');

-- Companion sync for service_categories
CREATE OR REPLACE FUNCTION public.sync_service_categories_companions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.created_by_code FROM public.profiles p WHERE p.id = NEW.created_by;
  ELSE
    NEW.created_by_code := NULL;
  END IF;

  IF NEW.updated_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.updated_by_code FROM public.profiles p WHERE p.id = NEW.updated_by;
  ELSE
    NEW.updated_by_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_categories_sync_companions ON public.service_categories;
CREATE TRIGGER trg_service_categories_sync_companions
  BEFORE INSERT OR UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_service_categories_companions();

-- Deterministic backfill of 6 official categories
DO $$
BEGIN
  UPDATE public.service_categories SET service_category_code = 'NHDV_01' WHERE code = 'WEBSITE_SEO' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_01');
  UPDATE public.service_categories SET service_category_code = 'NHDV_02' WHERE code = 'PERFORMANCE' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_02');
  UPDATE public.service_categories SET service_category_code = 'NHDV_03' WHERE code = 'SOCIAL_MEDIA' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_03');
  UPDATE public.service_categories SET service_category_code = 'NHDV_04' WHERE code = 'ECOMMERCE' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_04');
  UPDATE public.service_categories SET service_category_code = 'NHDV_05' WHERE code = 'CONTENT_PR' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_05');
  UPDATE public.service_categories SET service_category_code = 'NHDV_06' WHERE code = 'VIDEO_AI' AND (service_category_code IS NULL OR service_category_code <> 'NHDV_06');

  -- Backfill any others if present
  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + 6) AS rn
    FROM public.service_categories
    WHERE service_category_code IS NULL OR service_category_code !~ '^NHDV_[0-9]{2,}$'
  )
  UPDATE public.service_categories sc
  SET service_category_code = public.format_business_code('NHDV', n.rn)
  FROM numbered n
  WHERE sc.id = n.id;

  PERFORM setval(
    'public.service_categories_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(service_category_code, '^NHDV_', ''), '')::bigint), 0) FROM public.service_categories),
      6
    ) + 1,
    false
  );
END $$;

ALTER TABLE public.service_categories
  ALTER COLUMN service_category_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_categories_code_format'
  ) THEN
    ALTER TABLE public.service_categories
      ADD CONSTRAINT service_categories_code_format
      CHECK (service_category_code ~ '^NHDV_[0-9]{2,}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_categories_service_category_code_key'
  ) THEN
    ALTER TABLE public.service_categories
      ADD CONSTRAINT service_categories_service_category_code_key
      UNIQUE (service_category_code);
  END IF;
END $$;


-- ============================================================
-- 2. SERVICES (DV_XX)
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_category_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

CREATE OR REPLACE FUNCTION public.sync_services_category_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_category_id IS NOT NULL THEN
    SELECT sc.service_category_code
    INTO NEW.service_category_code
    FROM public.service_categories sc
    WHERE sc.id = NEW.service_category_id;
  ELSE
    NEW.service_category_code := NULL;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.created_by_code FROM public.profiles p WHERE p.id = NEW.created_by;
  ELSE
    NEW.created_by_code := NULL;
  END IF;

  IF NEW.updated_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.updated_by_code FROM public.profiles p WHERE p.id = NEW.updated_by;
  ELSE
    NEW.updated_by_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_sync_category_code ON public.services;
CREATE TRIGGER trg_services_sync_category_code
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_services_category_code();

-- Backfill services companions using safe subqueries
UPDATE public.services s
SET
  service_category_code = (
    SELECT sc.service_category_code
    FROM public.service_categories sc
    WHERE sc.id = s.service_category_id
  ),
  created_by_code = (
    SELECT p.account_code
    FROM public.profiles p
    WHERE p.id = s.created_by
  ),
  updated_by_code = (
    SELECT p.account_code
    FROM public.profiles p
    WHERE p.id = s.updated_by
  )
WHERE s.service_category_id IS NOT NULL;


-- ============================================================
-- 3. SERVICE DELIVERY ITEMS (HMDV_XX)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  delivery_item_code TEXT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.service_delivery_items
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_item_code TEXT,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS service_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

ALTER TABLE public.service_delivery_items ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.service_delivery_items_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generation trigger for HMDV_XX ensuring both delivery_item_code and legacy code are populated
CREATE OR REPLACE FUNCTION public.set_service_delivery_item_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.delivery_item_code IS NULL OR btrim(NEW.delivery_item_code) = '' THEN
    NEW.delivery_item_code := public.format_business_code(
      'HMDV',
      nextval('public.service_delivery_items_code_seq')
    );
  END IF;

  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := NEW.delivery_item_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_delivery_items_set_code ON public.service_delivery_items;
CREATE TRIGGER trg_service_delivery_items_set_code
  BEFORE INSERT ON public.service_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_delivery_item_code();

DROP TRIGGER IF EXISTS trg_service_delivery_items_code_immutable ON public.service_delivery_items;
CREATE TRIGGER trg_service_delivery_items_code_immutable
  BEFORE UPDATE ON public.service_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('delivery_item_code');

-- Companion sync for service_delivery_items
CREATE OR REPLACE FUNCTION public.sync_service_delivery_items_companions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL THEN
    SELECT s.service_code INTO NEW.service_code FROM public.services s WHERE s.id = NEW.service_id;
  ELSE
    NEW.service_code := NULL;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.created_by_code FROM public.profiles p WHERE p.id = NEW.created_by;
  ELSE
    NEW.created_by_code := NULL;
  END IF;

  IF NEW.updated_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.updated_by_code FROM public.profiles p WHERE p.id = NEW.updated_by;
  ELSE
    NEW.updated_by_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_delivery_items_sync_companions ON public.service_delivery_items;
CREATE TRIGGER trg_service_delivery_items_sync_companions
  BEFORE INSERT OR UPDATE ON public.service_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_service_delivery_items_companions();

-- Backfill delivery_item_code if any exist
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(delivery_item_code, '^HMDV_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.service_delivery_items
  WHERE delivery_item_code ~ '^HMDV_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.service_delivery_items
    WHERE delivery_item_code IS NULL OR delivery_item_code !~ '^HMDV_[0-9]{2,}$'
  )
  UPDATE public.service_delivery_items sdi
  SET
    delivery_item_code = public.format_business_code('HMDV', n.rn),
    code = COALESCE(sdi.code, public.format_business_code('HMDV', n.rn))
  FROM numbered n
  WHERE sdi.id = n.id;

  PERFORM setval(
    'public.service_delivery_items_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(delivery_item_code, '^HMDV_', ''), '')::bigint), 0) FROM public.service_delivery_items),
      0
    ) + 1,
    false
  );
END $$;

ALTER TABLE public.service_delivery_items
  ALTER COLUMN delivery_item_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_delivery_items_code_format'
  ) THEN
    ALTER TABLE public.service_delivery_items
      ADD CONSTRAINT service_delivery_items_code_format
      CHECK (delivery_item_code ~ '^HMDV_[0-9]{2,}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_delivery_items_delivery_item_code_key'
  ) THEN
    ALTER TABLE public.service_delivery_items
      ADD CONSTRAINT service_delivery_items_delivery_item_code_key
      UNIQUE (delivery_item_code);
  END IF;
END $$;


-- ============================================================
-- 4. PROJECT SERVICES (DVDA_XX)
-- ============================================================

ALTER TABLE public.project_services
  ADD COLUMN IF NOT EXISTS project_service_code TEXT;

CREATE SEQUENCE IF NOT EXISTS public.project_services_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.set_project_service_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_service_code IS NULL OR btrim(NEW.project_service_code) = '' THEN
    NEW.project_service_code := public.format_business_code(
      'DVDA',
      nextval('public.project_services_code_seq')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_services_set_code ON public.project_services;
CREATE TRIGGER trg_project_services_set_code
  BEFORE INSERT ON public.project_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_service_code();

DROP TRIGGER IF EXISTS trg_project_services_code_immutable ON public.project_services;
CREATE TRIGGER trg_project_services_code_immutable
  BEFORE UPDATE ON public.project_services
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('project_service_code');

-- Backfill project_services code if any exist
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(project_service_code, '^DVDA_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.project_services
  WHERE project_service_code ~ '^DVDA_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.project_services
    WHERE project_service_code IS NULL OR project_service_code !~ '^DVDA_[0-9]{2,}$'
  )
  UPDATE public.project_services ps
  SET project_service_code = public.format_business_code('DVDA', n.rn)
  FROM numbered n
  WHERE ps.id = n.id;

  PERFORM setval(
    'public.project_services_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(project_service_code, '^DVDA_', ''), '')::bigint), 0) FROM public.project_services),
      0
    ) + 1,
    false
  );
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_services_code_format'
  ) THEN
    ALTER TABLE public.project_services
      ADD CONSTRAINT project_services_code_format
      CHECK (project_service_code IS NULL OR project_service_code ~ '^DVDA_[0-9]{2,}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_services_project_service_code_key'
  ) THEN
    ALTER TABLE public.project_services
      ADD CONSTRAINT project_services_project_service_code_key
      UNIQUE (project_service_code);
  END IF;
END $$;


-- ============================================================
-- 5. PROJECT SERVICE ITEMS (HMDA_XX)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_service_item_code TEXT,
  project_service_id UUID NOT NULL REFERENCES public.project_services(id) ON DELETE CASCADE,
  project_service_code TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_code TEXT,
  source_delivery_item_id UUID REFERENCES public.service_delivery_items(id) ON DELETE SET NULL,
  source_delivery_item_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_service_items
  ADD COLUMN IF NOT EXISTS project_service_item_code TEXT,
  ADD COLUMN IF NOT EXISTS project_service_code TEXT,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_code TEXT,
  ADD COLUMN IF NOT EXISTS source_delivery_item_code TEXT,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

ALTER TABLE public.project_service_items ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.project_service_items_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generation trigger for HMDA_XX
CREATE OR REPLACE FUNCTION public.set_project_service_item_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_service_item_code IS NULL OR btrim(NEW.project_service_item_code) = '' THEN
    NEW.project_service_item_code := public.format_business_code(
      'HMDA',
      nextval('public.project_service_items_code_seq')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_service_items_set_code ON public.project_service_items;
CREATE TRIGGER trg_project_service_items_set_code
  BEFORE INSERT ON public.project_service_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_service_item_code();

DROP TRIGGER IF EXISTS trg_project_service_items_code_immutable ON public.project_service_items;
CREATE TRIGGER trg_project_service_items_code_immutable
  BEFORE UPDATE ON public.project_service_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_code_column_update('project_service_item_code');

-- Companion sync for project_service_items
CREATE OR REPLACE FUNCTION public.sync_project_service_items_companions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_service_id IS NOT NULL THEN
    SELECT ps.project_service_code, ps.project_id, ps.project_code
    INTO NEW.project_service_code, NEW.project_id, NEW.project_code
    FROM public.project_services ps
    WHERE ps.id = NEW.project_service_id;
  END IF;

  IF NEW.source_delivery_item_id IS NOT NULL THEN
    SELECT sdi.delivery_item_code
    INTO NEW.source_delivery_item_code
    FROM public.service_delivery_items sdi
    WHERE sdi.id = NEW.source_delivery_item_id;
  ELSE
    NEW.source_delivery_item_code := NULL;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.created_by_code FROM public.profiles p WHERE p.id = NEW.created_by;
  ELSE
    NEW.created_by_code := NULL;
  END IF;

  IF NEW.updated_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.updated_by_code FROM public.profiles p WHERE p.id = NEW.updated_by;
  ELSE
    NEW.updated_by_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_service_items_sync_companions ON public.project_service_items;
CREATE TRIGGER trg_project_service_items_sync_companions
  BEFORE INSERT OR UPDATE ON public.project_service_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_service_items_companions();

-- Backfill project_service_items code if any exist
DO $$
DECLARE
  max_num bigint := 0;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(project_service_item_code, '^HMDA_', ''), '')::bigint), 0)
  INTO max_num
  FROM public.project_service_items
  WHERE project_service_item_code ~ '^HMDA_[0-9]+$';

  WITH numbered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + max_num) AS rn
    FROM public.project_service_items
    WHERE project_service_item_code IS NULL OR project_service_item_code !~ '^HMDA_[0-9]{2,}$'
  )
  UPDATE public.project_service_items psi
  SET project_service_item_code = public.format_business_code('HMDA', n.rn)
  FROM numbered n
  WHERE psi.id = n.id;

  PERFORM setval(
    'public.project_service_items_code_seq',
    GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(project_service_item_code, '^HMDA_', ''), '')::bigint), 0) FROM public.project_service_items),
      0
    ) + 1,
    false
  );
END $$;

ALTER TABLE public.project_service_items
  ALTER COLUMN project_service_item_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_service_items_code_format'
  ) THEN
    ALTER TABLE public.project_service_items
      ADD CONSTRAINT project_service_items_code_format
      CHECK (project_service_item_code ~ '^HMDA_[0-9]{2,}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_service_items_project_service_item_code_key'
  ) THEN
    ALTER TABLE public.project_service_items
      ADD CONSTRAINT project_service_items_project_service_item_code_key
      UNIQUE (project_service_item_code);
  END IF;
END $$;


-- ============================================================
-- 6. TASKS (CV_XX) & CROSS-PROJECT VALIDATION
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_service_item_id UUID REFERENCES public.project_service_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_service_item_code TEXT;

CREATE OR REPLACE FUNCTION public.validate_task_project_service_item_and_sync_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_project_id UUID;
  target_item_code TEXT;
BEGIN
  IF NEW.project_service_item_id IS NOT NULL THEN
    SELECT psi.project_id, psi.project_service_item_code
    INTO target_project_id, target_item_code
    FROM public.project_service_items psi
    WHERE psi.id = NEW.project_service_item_id;

    IF target_project_id IS NULL THEN
      RAISE EXCEPTION 'Referenced project_service_item (%) does not exist.', NEW.project_service_item_id
        USING ERRCODE = 'P3001';
    END IF;

    IF target_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Cross-project linking forbidden: Task belongs to project %, but project_service_item belongs to project %.',
        NEW.project_id, target_project_id
        USING ERRCODE = 'P3002';
    END IF;

    NEW.project_service_item_code := target_item_code;
  ELSE
    NEW.project_service_item_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_validate_project_service_item ON public.tasks;
CREATE TRIGGER trg_tasks_validate_project_service_item
  BEFORE INSERT OR UPDATE OF project_id, project_service_item_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_project_service_item_and_sync_code();


-- ============================================================
-- 7. DEPARTMENTS: sort_order BACKFILL
-- ============================================================

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  UPDATE public.departments SET sort_order = 1 WHERE department_code = 'PB_01' OR code = 'ACCOUNT_SALES';
  UPDATE public.departments SET sort_order = 2 WHERE department_code = 'PB_02' OR code = 'WEB_TECH';
  UPDATE public.departments SET sort_order = 3 WHERE department_code = 'PB_03' OR code = 'SEO_LOCAL';
  UPDATE public.departments SET sort_order = 4 WHERE department_code = 'PB_04' OR code = 'PERFORMANCE_MKT';
  UPDATE public.departments SET sort_order = 5 WHERE department_code = 'PB_05' OR code = 'SOCIAL_CONTENT';
  UPDATE public.departments SET sort_order = 6 WHERE department_code = 'PB_06' OR code = 'CREATIVE_AI';
  UPDATE public.departments SET sort_order = 7 WHERE department_code = 'PB_07' OR code = 'ECOMMERCE';
  UPDATE public.departments SET sort_order = 8 WHERE department_code = 'PB_08' OR code = 'HR_ADMIN';
  UPDATE public.departments SET sort_order = 9 WHERE department_code = 'PB_09' OR code = 'FINANCE_ACC';
END $$;


-- ============================================================
-- 8. SNAPSHOT TRIGGER ON project_services (SINGLE SOURCE OF TRUTH)
-- ============================================================

CREATE OR REPLACE FUNCTION public.snapshot_project_service_delivery_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.project_service_items (
    project_service_id,
    project_id,
    source_delivery_item_id,
    name,
    description,
    sort_order,
    is_required,
    status,
    created_by,
    updated_by
  )
  SELECT
    NEW.id,
    NEW.project_id,
    sdi.id,
    sdi.name,
    sdi.description,
    sdi.sort_order,
    COALESCE(sdi.is_required, TRUE),
    'planned',
    NEW.created_by,
    NEW.created_by
  FROM public.service_delivery_items sdi
  WHERE sdi.service_id = NEW.service_id
    AND sdi.active = TRUE
  ORDER BY sdi.sort_order ASC, sdi.created_at ASC;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_project_service_delivery_items ON public.project_services;
CREATE TRIGGER trg_snapshot_project_service_delivery_items
  AFTER INSERT ON public.project_services
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_project_service_delivery_items();
