-- ============================================================
-- Migration: Add PGS Departments & Department Head Support
-- Timestamp: 20260819034520_add_pgs_departments_and_department_head.sql
-- Description:
--   1. Adds head_user_id (UUID) and head_user_code (TEXT companion) to departments.
--   2. Sets up triggers to sync head_user_code.
--   3. Seeds/syncs the 9 official PGS departments (PB_01..PB_09).
--   4. Updates sequence so next department is PB_10.
-- ============================================================

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS head_user_code TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Trigger to sync head_user_code
CREATE OR REPLACE FUNCTION public.sync_departments_head_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.head_user_id IS NOT NULL THEN
    SELECT COALESCE(ep.employee_code, p.account_code)
    INTO NEW.head_user_code
    FROM public.profiles p
    LEFT JOIN public.employee_profiles ep ON ep.user_id = p.id
    WHERE p.id = NEW.head_user_id;
  ELSE
    NEW.head_user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_departments_sync_head_code ON public.departments;
CREATE TRIGGER trg_departments_sync_head_code
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_departments_head_code();

-- Seed 9 Official PGS Departments
INSERT INTO public.departments (department_code, code, name, description, sort_order, is_active)
VALUES
  ('PB_01', 'ACCOUNT_SALES', 'Kinh doanh & Account', 'Phòng Kinh doanh, Tư vấn & Chăm sóc Khách hàng', 1, TRUE),
  ('PB_02', 'WEB_TECH', 'Website & Technology', 'Phòng Lập trình, Phát triển Website & Công nghệ', 2, TRUE),
  ('PB_03', 'SEO_LOCAL', 'SEO & Local Search', 'Phòng Tối ưu hóa Công cụ Tìm kiếm & Google Maps', 3, TRUE),
  ('PB_04', 'PERFORMANCE_MKT', 'Performance Marketing', 'Phòng Quảng cáo Chuyển đổi (Google, Facebook, TikTok Ads)', 4, TRUE),
  ('PB_05', 'SOCIAL_CONTENT', 'Social Media & Content', 'Phòng Quản trị Mạng xã hội, Xây kênh & Sáng tạo Nội dung', 5, TRUE),
  ('PB_06', 'CREATIVE_AI', 'Creative, Video & AI', 'Phòng Sản xuất Video, Media, Thiết kế & Ứng dụng AI', 6, TRUE),
  ('PB_07', 'ECOMMERCE', 'E-Commerce', 'Phòng Thiết lập & Vận hành Sàn Thương mại Điện tử', 7, TRUE),
  ('PB_08', 'HR_ADMIN', 'Nhân sự & Hành chính', 'Phòng Nhân sự, Tuyển dụng & Hành chính Tổng hợp', 8, TRUE),
  ('PB_09', 'FINANCE_ACC', 'Tài chính & Kế toán', 'Phòng Quản trị Tài chính, Kế toán & Dòng tiền', 9, TRUE)
ON CONFLICT (department_code) DO UPDATE
SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Update departments sequence to 10 (next is PB_10)
PERFORM setval('public.departments_code_seq', 10, false);
