-- ============================================================
-- Migration: Company Documents Module V1
-- Timestamp: 20260820132000_company_documents_v1.sql
-- Entity: company_documents (Business Code: TL_01...)
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('policy_procedure', 'contract_template', 'marketing_asset', 'brand_guidelines', 'financial_report', 'general')),
  storage_bucket TEXT NOT NULL DEFAULT 'company-documents',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'public_company' CHECK (access_level IN ('public_company', 'internal_only', 'management_only')),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  department_code TEXT,
  uploaded_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_by_user_code TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  delete_status TEXT NOT NULL DEFAULT 'active' CHECK (delete_status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_company_documents_code_format
    CHECK (document_code IS NULL OR document_code ~ '^TL_[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_company_documents_category ON public.company_documents(category);
CREATE INDEX IF NOT EXISTS idx_company_documents_access_level ON public.company_documents(access_level);
CREATE INDEX IF NOT EXISTS idx_company_documents_department_id ON public.company_documents(department_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_uploaded_by ON public.company_documents(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_delete_status ON public.company_documents(delete_status);

CREATE SEQUENCE IF NOT EXISTS public.company_documents_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_company_document_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.document_code IS NULL OR NEW.document_code = '' THEN
    NEW.document_code := 'TL_' || LPAD(nextval('public.company_documents_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_company_document_code ON public.company_documents;
CREATE TRIGGER trg_generate_company_document_code
  BEFORE INSERT ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_company_document_code();

-- Companion sync for company_documents
CREATE OR REPLACE FUNCTION public.tg_sync_company_documents_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    SELECT department_code INTO NEW.department_code FROM public.departments WHERE id = NEW.department_id;
  ELSE
    NEW.department_code := NULL;
  END IF;

  IF NEW.uploaded_by_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.uploaded_by_user_code FROM public.profiles WHERE id = NEW.uploaded_by_user_id;
  ELSE
    NEW.uploaded_by_user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_documents_companion_codes ON public.company_documents;
CREATE TRIGGER trg_sync_company_documents_companion_codes
  BEFORE INSERT OR UPDATE ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_company_documents_companion_codes();

-- Immutability guard on document_code
CREATE OR REPLACE FUNCTION public.prevent_company_document_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.document_code IS NOT NULL AND NEW.document_code IS DISTINCT FROM OLD.document_code THEN
    RAISE EXCEPTION 'document_code is immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_company_document_code ON public.company_documents;
CREATE TRIGGER trg_immutable_company_document_code
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_company_document_code_update();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.company_documents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.company_documents TO service_role;
