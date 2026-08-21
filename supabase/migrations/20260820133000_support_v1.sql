-- ============================================================
-- Migration: Customer Support Module V1
-- Timestamp: 20260820133000_support_v1.sql
-- Entities:
--   1. support_tickets (Business Code: YC_01...)
--   2. support_ticket_messages
-- Access Model: Backend-only (service_role), RLS enabled, Browser revoked
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT UNIQUE,
  client_company_id UUID NOT NULL REFERENCES public.client_companies(id) ON DELETE CASCADE,
  client_company_code TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_code TEXT,
  creator_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  creator_user_code TEXT,
  assignee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_user_code TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'project_scope', 'bug_report', 'general')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_support_tickets_code_format
    CHECK (ticket_code IS NULL OR ticket_code ~ '^YC_[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client_company_id ON public.support_tickets(client_company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_project_id ON public.support_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_creator ON public.support_tickets(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON public.support_tickets(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

CREATE SEQUENCE IF NOT EXISTS public.support_tickets_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.tg_generate_support_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
    NEW.ticket_code := 'YC_' || LPAD(nextval('public.support_tickets_code_seq')::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_support_ticket_code ON public.support_tickets;
CREATE TRIGGER trg_generate_support_ticket_code
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generate_support_ticket_code();

-- Companion sync for support_tickets
CREATE OR REPLACE FUNCTION public.tg_sync_support_tickets_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.client_company_id IS NOT NULL THEN
    SELECT COALESCE(client_code, code) INTO NEW.client_company_code FROM public.client_companies WHERE id = NEW.client_company_id;
  ELSE
    NEW.client_company_code := NULL;
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    SELECT project_code INTO NEW.project_code FROM public.projects WHERE id = NEW.project_id;
  ELSE
    NEW.project_code := NULL;
  END IF;

  IF NEW.creator_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.creator_user_code FROM public.profiles WHERE id = NEW.creator_user_id;
  ELSE
    NEW.creator_user_code := NULL;
  END IF;

  IF NEW.assignee_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.assignee_user_code FROM public.profiles WHERE id = NEW.assignee_user_id;
  ELSE
    NEW.assignee_user_code := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_tickets_companion_codes ON public.support_tickets;
CREATE TRIGGER trg_sync_support_tickets_companion_codes
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_support_tickets_companion_codes();

-- Immutability guard on ticket_code
CREATE OR REPLACE FUNCTION public.prevent_support_ticket_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.ticket_code IS NOT NULL AND NEW.ticket_code IS DISTINCT FROM OLD.ticket_code THEN
    RAISE EXCEPTION 'ticket_code is immutable once set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_support_ticket_code ON public.support_tickets;
CREATE TRIGGER trg_immutable_support_ticket_code
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_support_ticket_code_update();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.support_tickets TO service_role;

-- Support Ticket Messages table
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  ticket_code TEXT,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sender_user_code TEXT,
  content TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_sender ON public.support_ticket_messages(sender_user_id);

-- Companion sync for support_ticket_messages
CREATE OR REPLACE FUNCTION public.tg_sync_support_ticket_messages_companion_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT ticket_code INTO NEW.ticket_code FROM public.support_tickets WHERE id = NEW.ticket_id;
  ELSE
    NEW.ticket_code := NULL;
  END IF;

  IF NEW.sender_user_id IS NOT NULL THEN
    SELECT account_code INTO NEW.sender_user_code FROM public.profiles WHERE id = NEW.sender_user_id;
  ELSE
    NEW.sender_user_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_ticket_messages_companion_codes ON public.support_ticket_messages;
CREATE TRIGGER trg_sync_support_ticket_messages_companion_codes
  BEFORE INSERT OR UPDATE ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_support_ticket_messages_companion_codes();

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_ticket_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.support_ticket_messages TO service_role;
