-- ============================================================
-- Migration: Service Catalog & Delivery Items Foundation
-- Timestamp: 20260819032116_service_catalog_delivery_foundation.sql
-- Description:
--   1. Creates service_categories table (NHDV_01...) with 6 official categories.
--   2. Links services to service_categories and seeds 26 official services (DV_01..DV_26).
--   3. Creates service_delivery_items table (HMDV_01...) for standard service templates.
--   4. Enhances project_services with DVDA_01... business codes.
--   5. Creates project_service_items table (HMDA_01...) for instance/snapshot items.
--   6. Adds project_service_item_id and project_service_item_code (HMDA_XX) to tasks
--      with cross-project linking validation trigger.
--   7. Configures sequences, format constraints, immutability, and companion code sync triggers.
-- ============================================================

-- ============================================================
-- 1. TABLE: service_categories (NHDV_XX)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category_code TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_categories_code_format
    CHECK (service_category_code ~ '^NHDV_[0-9]{2,}$'),
  CONSTRAINT service_categories_name_not_blank
    CHECK (length(btrim(name)) >= 2)
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.service_categories_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generate NHDV_XX
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

DROP TRIGGER IF EXISTS trg_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER trg_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Seed 6 Official Service Categories
INSERT INTO public.service_categories (service_category_code, code, name, sort_order, is_active)
VALUES
  ('NHDV_01', 'WEBSITE_SEO', 'Website & SEO', 1, TRUE),
  ('NHDV_02', 'PERFORMANCE', 'Performance', 2, TRUE),
  ('NHDV_03', 'SOCIAL_MEDIA', 'Social Media', 3, TRUE),
  ('NHDV_04', 'ECOMMERCE', 'E-Commerce', 4, TRUE),
  ('NHDV_05', 'CONTENT_PR', 'Content & PR', 5, TRUE),
  ('NHDV_06', 'VIDEO_AI', 'Video & AI', 6, TRUE)
ON CONFLICT (service_category_code) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

PERFORM setval('public.service_categories_code_seq', 7, false);


-- ============================================================
-- 2. TABLE: services (DV_XX) ENHANCEMENT & 26 OFFICIAL SERVICES
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_category_id UUID REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS service_category_code TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_code TEXT;

-- Sync service_category_code trigger
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

-- Seed 26 Official Services
DO $$
DECLARE
  cat_web_id UUID;
  cat_perf_id UUID;
  cat_soc_id UUID;
  cat_ecom_id UUID;
  cat_cont_id UUID;
  cat_video_id UUID;
BEGIN
  SELECT id INTO cat_web_id FROM public.service_categories WHERE service_category_code = 'NHDV_01';
  SELECT id INTO cat_perf_id FROM public.service_categories WHERE service_category_code = 'NHDV_02';
  SELECT id INTO cat_soc_id FROM public.service_categories WHERE service_category_code = 'NHDV_03';
  SELECT id INTO cat_ecom_id FROM public.service_categories WHERE service_category_code = 'NHDV_04';
  SELECT id INTO cat_cont_id FROM public.service_categories WHERE service_category_code = 'NHDV_05';
  SELECT id INTO cat_video_id FROM public.service_categories WHERE service_category_code = 'NHDV_06';

  -- 01 WEBSITE & SEO
  INSERT INTO public.services (service_code, code, name, service_category_id, sort_order, active)
  VALUES
    ('DV_01', 'DV_01_WEB_DESIGN', 'Thiết kế Website', cat_web_id, 1, TRUE),
    ('DV_02', 'DV_02_LANDING_PAGE', 'Landing Page', cat_web_id, 2, TRUE),
    ('DV_03', 'DV_03_WEB_CARE', 'Chăm sóc Website', cat_web_id, 3, TRUE),
    ('DV_04', 'DV_04_SEO_OVERALL', 'SEO Tổng Thể', cat_web_id, 4, TRUE),
    ('DV_05', 'DV_05_CONTENT_WEB', 'Content Website', cat_web_id, 5, TRUE),
    ('DV_06', 'DV_06_GOOGLE_BUSINESS', 'Google Business', cat_web_id, 6, TRUE),

  -- 02 PERFORMANCE
    ('DV_07', 'DV_07_GOOGLE_ADS', 'Google Ads', cat_perf_id, 7, TRUE),
    ('DV_08', 'DV_08_FB_ADS', 'Facebook Ads', cat_perf_id, 8, TRUE),
    ('DV_09', 'DV_09_TIKTOK_ADS', 'TikTok Ads', cat_perf_id, 9, TRUE),

  -- 03 SOCIAL MEDIA
    ('DV_10', 'DV_10_FANPAGE_OPS', 'Vận hành Fanpage', cat_soc_id, 10, TRUE),
    ('DV_11', 'DV_11_INSTAGRAM', 'Instagram', cat_soc_id, 11, TRUE),
    ('DV_12', 'DV_12_TIKTOK_CHANNEL', 'Xây kênh TikTok', cat_soc_id, 12, TRUE),
    ('DV_13', 'DV_13_FANPAGE_BLUE_TICK', 'Tick xanh Fanpage', cat_soc_id, 13, TRUE),
    ('DV_14', 'DV_14_FANPAGE_TRADE', 'Mua bán Fanpage', cat_soc_id, 14, TRUE),

  -- 04 E-COMMERCE
    ('DV_15', 'DV_15_TIKTOK_SHOP_SETUP', 'Setup TikTok Shop', cat_ecom_id, 15, TRUE),
    ('DV_16', 'DV_16_TIKTOK_SHOP_OPS', 'Vận hành TikTok Shop', cat_ecom_id, 16, TRUE),
    ('DV_17', 'DV_17_SHOPEE_OPS', 'Vận hành Shopee', cat_ecom_id, 17, TRUE),

  -- 05 CONTENT & PR
    ('DV_18', 'DV_18_CONTENT_SOCIAL', 'Content Social', cat_cont_id, 18, TRUE),
    ('DV_19', 'DV_19_PR_PRESS', 'PR Báo chí', cat_cont_id, 19, TRUE),

  -- 06 VIDEO & AI
    ('DV_20', 'DV_20_VIDEO_TIKTOK', 'Video TikTok', cat_video_id, 20, TRUE),
    ('DV_21', 'DV_21_VIDEO_ADS', 'Video Quảng Cáo', cat_video_id, 21, TRUE),
    ('DV_22', 'DV_22_REVIEW_PROD', 'Review Sản Phẩm', cat_video_id, 22, TRUE),
    ('DV_23', 'DV_23_REVIEW_LOC', 'Review Địa Điểm', cat_video_id, 23, TRUE),
    ('DV_24', 'DV_24_VIDEO_AI', 'Video AI', cat_video_id, 24, TRUE),
    ('DV_25', 'DV_25_VEO_3', 'VEO 3', cat_video_id, 25, TRUE),
    ('DV_26', 'DV_26_GROK', 'Grok', cat_video_id, 26, TRUE)
  ON CONFLICT (service_code) DO UPDATE
  SET
    name = EXCLUDED.name,
    service_category_id = EXCLUDED.service_category_id,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active;

  PERFORM setval('public.services_code_seq', 27, false);
END $$;


-- ============================================================
-- 3. TABLE: service_delivery_items (HMDV_XX)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.service_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_item_code TEXT NOT NULL UNIQUE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_delivery_items_code_format
    CHECK (delivery_item_code ~ '^HMDV_[0-9]{2,}$'),
  CONSTRAINT service_delivery_items_name_not_blank
    CHECK (length(btrim(name)) >= 1)
);

ALTER TABLE public.service_delivery_items ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.service_delivery_items_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generate HMDV_XX
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

-- Sync companions for service_delivery_items
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

DROP TRIGGER IF EXISTS trg_service_delivery_items_updated_at ON public.service_delivery_items;
CREATE TRIGGER trg_service_delivery_items_updated_at
  BEFORE UPDATE ON public.service_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. TABLE: project_services (DVDA_XX) ENHANCEMENT
-- ============================================================

ALTER TABLE public.project_services
  ADD COLUMN IF NOT EXISTS project_service_code TEXT UNIQUE;

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

-- Backfill existing project_services if any
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


-- ============================================================
-- 5. TABLE: project_service_items (HMDA_XX)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_service_item_code TEXT NOT NULL UNIQUE,
  project_service_id UUID NOT NULL REFERENCES public.project_services(id) ON DELETE CASCADE,
  project_service_code TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_code TEXT,
  source_delivery_item_id UUID REFERENCES public.service_delivery_items(id) ON DELETE SET NULL,
  source_delivery_item_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_code TEXT,
  updated_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_service_items_code_format
    CHECK (project_service_item_code ~ '^HMDA_[0-9]{2,}$'),
  CONSTRAINT project_service_items_name_not_blank
    CHECK (length(btrim(name)) >= 1)
);

ALTER TABLE public.project_service_items ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.project_service_items_code_seq
  START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- Auto-generate HMDA_XX
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

-- Sync companions for project_service_items
CREATE OR REPLACE FUNCTION public.sync_project_service_items_companions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Sync project_service_code and project_id from project_services
  IF NEW.project_service_id IS NOT NULL THEN
    SELECT ps.project_service_code, ps.project_id, ps.project_code
    INTO NEW.project_service_code, NEW.project_id, NEW.project_code
    FROM public.project_services ps
    WHERE ps.id = NEW.project_service_id;
  END IF;

  -- Sync source_delivery_item_code
  IF NEW.source_delivery_item_id IS NOT NULL THEN
    SELECT sdi.delivery_item_code
    INTO NEW.source_delivery_item_code
    FROM public.service_delivery_items sdi
    WHERE sdi.id = NEW.source_delivery_item_id;
  ELSE
    NEW.source_delivery_item_code := NULL;
  END IF;

  -- Sync created_by_code
  IF NEW.created_by IS NOT NULL THEN
    SELECT p.account_code INTO NEW.created_by_code FROM public.profiles p WHERE p.id = NEW.created_by;
  ELSE
    NEW.created_by_code := NULL;
  END IF;

  -- Sync updated_by_code
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

DROP TRIGGER IF EXISTS trg_project_service_items_updated_at ON public.project_service_items;
CREATE TRIGGER trg_project_service_items_updated_at
  BEFORE UPDATE ON public.project_service_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. TABLE: tasks (CV_XX) ENHANCEMENT & CROSS-PROJECT VALIDATION
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_service_item_id UUID REFERENCES public.project_service_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_service_item_code TEXT;

-- Trigger to validate cross-project linking and sync companion code
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
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_project_service_item_and_sync_code();

-- Indexes for optimal lookup
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(service_category_id);
CREATE INDEX IF NOT EXISTS idx_service_delivery_items_service_id ON public.service_delivery_items(service_id);
CREATE INDEX IF NOT EXISTS idx_project_service_items_project_id ON public.project_service_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_service_items_ps_id ON public.project_service_items(project_service_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_service_item_id ON public.tasks(project_service_item_id);
